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

    $model = isset($input['model']) && is_string($input['model']) && trim($input['model']) !== ''
        ? trim($input['model'])
        : 'openai/gpt-4.1-mini';

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
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Invalid request payload']]);
    exit;
}

$ch = curl_init($apiBase . '/chat/completions');
if ($ch === false) {
    http_response_code(500);
    echo json_encode(['error' => ['message' => 'Failed to initialize cURL']]);
    exit;
}

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 60,
]);

$responseBody = curl_exec($ch);
$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
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
