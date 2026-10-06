<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => ['message' => 'Method not allowed']]);
    exit;
}

$rawInput = file_get_contents('php://input');
if ($rawInput === false || trim($rawInput) === '') {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Missing JSON body']]);
    exit;
}

$input = json_decode($rawInput, true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Invalid JSON body']]);
    exit;
}

$localConfig = [];
$localConfigPath = __DIR__ . '/gateway-config.php';
if (is_file($localConfigPath)) {
    $loaded = require $localConfigPath;
    if (is_array($loaded)) {
        $localConfig = $loaded;
    }
}

$apiKey = getenv('OPENROUTER_API_KEY');
if (!$apiKey && isset($localConfig['OPENROUTER_API_KEY']) && is_string($localConfig['OPENROUTER_API_KEY'])) {
    $apiKey = trim($localConfig['OPENROUTER_API_KEY']);
}

if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => ['message' => 'Server API key not configured']]);
    exit;
}

$apiBase = 'https://openrouter.ai/api/v1';
if (isset($localConfig['OPENROUTER_API_BASE']) && is_string($localConfig['OPENROUTER_API_BASE']) && trim($localConfig['OPENROUTER_API_BASE']) !== '') {
    $apiBase = rtrim(trim($localConfig['OPENROUTER_API_BASE']), '/');
}

$requestBody = null;
if (isset($input['requestBody']) && is_array($input['requestBody'])) {
    $requestBody = $input['requestBody'];
}

if (!$requestBody) {
    $prompt = isset($input['prompt']) && is_string($input['prompt']) ? trim($input['prompt']) : '';
    if ($prompt === '') {
        http_response_code(400);
        echo json_encode(['error' => ['message' => 'Missing prompt or requestBody']]);
        exit;
    }

    // Default only applies when the client sends no model. Kept free so a
    // bare prompt does not silently spend credits. Matches the browser-side
    // default in config.js / src/api.js.
    $configuredModel = isset($localConfig['OPENROUTER_MODEL']) && is_string($localConfig['OPENROUTER_MODEL'])
        ? trim($localConfig['OPENROUTER_MODEL'])
        : '';

    $model = isset($input['model']) && is_string($input['model']) && trim($input['model']) !== ''
        ? trim($input['model'])
        : ($configuredModel !== '' ? $configuredModel : 'google/gemma-4-26b-a4b-it:free');

    $requestBody = [
        'model' => $model,
        'messages' => [
            ['role' => 'user', 'content' => $prompt],
        ],
        'temperature' => 0.7,
        'max_tokens' => 700,
    ];
}

$payload = json_encode($requestBody);
if ($payload === false) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Invalid request payload']]);
    exit;
}

$ch = curl_init($apiBase . '/chat/completions');
if ($ch === false) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['error' => ['message' => 'Failed to initialize cURL']]);
    exit;
}

$streamRequested = isset($requestBody['stream']) && $requestBody['stream'] === true;
$upstreamStatusCode = 0;
$streamedErrorBody = '';

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HEADERFUNCTION => static function ($ch, string $headerLine) use (&$upstreamStatusCode): int {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})/i', trim($headerLine), $match) === 1) {
            $upstreamStatusCode = (int) $match[1];
        }
        return strlen($headerLine);
    },
]);

if ($streamRequested) {
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache, no-transform');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');

    while (ob_get_level() > 0) {
        ob_end_flush();
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, static function ($ch, string $chunk) use (&$upstreamStatusCode, &$streamedErrorBody): int {
        if ($upstreamStatusCode >= 400) {
            $streamedErrorBody .= $chunk;
            return strlen($chunk);
        }

        echo $chunk;
        if (function_exists('ob_flush')) {
            @ob_flush();
        }
        flush();
        return strlen($chunk);
    });

    $streamExecResult = curl_exec($ch);
    $statusCode = $upstreamStatusCode > 0 ? $upstreamStatusCode : curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($streamExecResult === false) {
        echo "data: " . json_encode(['error' => ['message' => 'Gateway request failed: ' . $curlError]]) . "\n\n";
        flush();
        exit;
    }

    if ($statusCode >= 400) {
        $errorPayload = ['error' => ['message' => 'Upstream streaming request failed']];
        $decoded = json_decode($streamedErrorBody, true);
        if (is_array($decoded)) {
            $errorPayload = $decoded;
        }
        echo "data: " . json_encode($errorPayload) . "\n\n";
        echo "data: [DONE]\n\n";
        flush();
        exit;
    }

    exit;
}

header('Content-Type: application/json; charset=utf-8');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$responseBody = curl_exec($ch);
$statusCode = $upstreamStatusCode > 0 ? $upstreamStatusCode : curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($responseBody === false) {
    http_response_code(502);
    echo json_encode(['error' => ['message' => 'Gateway request failed: ' . $curlError]]);
    exit;
}

if ($statusCode < 200 || $statusCode >= 300) {
    http_response_code($statusCode > 0 ? $statusCode : 502);
    echo $responseBody;
    exit;
}

echo $responseBody;
