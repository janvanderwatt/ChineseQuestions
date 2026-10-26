<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

$localConfig = [];
$localConfigPath = __DIR__ . '/gateway-config.php';
if (is_file($localConfigPath)) {
    $loaded = require $localConfigPath;
    if (is_array($loaded)) {
        $localConfig = $loaded;
    }
}

// ---------------------------------------------------------------------------
// Abuse protection helpers
//
// Two independent controls, both configured in gateway-config.php:
//   * an optional shared site password, sent by the browser as the
//     X-Site-Password header and checked against a password_hash();
//   * per-client rate limits (default 3/minute, 50/day) kept in a JSON file
//     outside the deploy target so a redeploy does not reset the counters.
// ---------------------------------------------------------------------------

const AUTH_FAILURE_WINDOW = 900; // seconds a failed password attempt is remembered
const AUTH_FAILURE_LIMIT = 10;   // failed attempts allowed per window, per client

/**
 * Read an integer setting from gateway-config.php, falling back to a default.
 * A value of 0 or less disables that limit.
 */
function rl_config_int(array $config, string $key, int $default): int
{
    if (isset($config[$key]) && is_numeric($config[$key])) {
        return max(0, (int) $config[$key]);
    }

    return $default;
}

/**
 * Directory holding the JSON counters. Kept outside the deploy target so that
 * wiping public/ does not wipe the counters. Falls back to the temp dir.
 */
function rl_store_dir(array $config): string
{
    $candidates = [];

    if (isset($config['RATE_LIMIT_DIR']) && is_string($config['RATE_LIMIT_DIR']) && trim($config['RATE_LIMIT_DIR']) !== '') {
        $candidates[] = rtrim(trim($config['RATE_LIMIT_DIR']), '/\\');
    }

    // .../apps/chineseqa/var/rate-limit when deployed as
    // .../apps/chineseqa/v1/public/api/openrouter-gateway.php
    $candidates[] = dirname(__DIR__, 3) . '/var/rate-limit';
    $candidates[] = sys_get_temp_dir() . '/chineseqa-rate-limit';

    foreach ($candidates as $dir) {
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            continue;
        }

        if (is_writable($dir)) {
            return $dir;
        }
    }

    throw new RuntimeException('No writable directory for rate limit storage');
}

/** Stable per-client key. Hashed so the counter file never stores raw IPs. */
function rl_client_key(array $config): string
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';

    if (!empty($config['TRUST_PROXY']) && isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $forwarded = (string) $_SERVER['HTTP_X_FORWARDED_FOR'];
        if (trim($forwarded) !== '') {
            $candidate = trim(explode(',', $forwarded)[0]);
            if (filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
                $ip = $candidate;
            }
        }
    }

    if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
        $ip = 'unknown';
    }

    return hash('sha256', $ip);
}

/** Drop timestamps older than the day window, then drop empty buckets. */
function rl_prune(array &$data): void
{
    $cutoff = time() - 86400;

    foreach ($data as $key => $bucket) {
        if (!is_array($bucket)) {
            unset($data[$key]);
            continue;
        }

        foreach (['hits', 'fails'] as $field) {
            $list = isset($bucket[$field]) && is_array($bucket[$field]) ? $bucket[$field] : [];
            $kept = [];
            foreach ($list as $timestamp) {
                if (is_numeric($timestamp) && (int) $timestamp > $cutoff) {
                    $kept[] = (int) $timestamp;
                }
            }
            $data[$key][$field] = $kept;
        }

        if (count($data[$key]['hits']) === 0 && count($data[$key]['fails']) === 0) {
            unset($data[$key]);
        }
    }
}

/**
 * Read-modify-write the counter file under an exclusive lock. The callback
 * receives the decoded store by reference and returns whatever it wants.
 */
function rl_mutate(string $storeFile, callable $mutator)
{
    $handle = fopen($storeFile, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to open rate limit store');
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Unable to lock rate limit store');
        }

        $raw = stream_get_contents($handle);
        $data = [];
        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }

        $result = $mutator($data);

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, (string) json_encode($data));
        fflush($handle);

        return $result;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

/**
 * Check the per-client request budget and record a hit when allowed.
 *
 * @return array{allowed: bool, retryAfter: int, reason: string}
 */
function rl_hit_gate(string $storeFile, string $clientKey, array $config, bool $clearFailures): array
{
    $perMinute = rl_config_int($config, 'RATE_LIMIT_PER_MINUTE', 3);
    $perDay = rl_config_int($config, 'RATE_LIMIT_PER_DAY', 50);

    if ($perMinute === 0 && $perDay === 0 && !$clearFailures) {
        return ['allowed' => true, 'retryAfter' => 0, 'reason' => ''];
    }

    $now = time();

    return rl_mutate($storeFile, static function (array &$data) use ($now, $clientKey, $perMinute, $perDay, $clearFailures): array {
        rl_prune($data);

        $bucket = isset($data[$clientKey]) && is_array($data[$clientKey])
            ? $data[$clientKey]
            : ['hits' => [], 'fails' => []];
        $hits = isset($bucket['hits']) && is_array($bucket['hits']) ? $bucket['hits'] : [];
        $fails = isset($bucket['fails']) && is_array($bucket['fails']) ? $bucket['fails'] : [];

        if ($clearFailures) {
            $fails = [];
        }

        $decision = ['allowed' => true, 'retryAfter' => 0, 'reason' => ''];

        $minuteStart = $now - 60;
        $inMinute = [];
        foreach ($hits as $timestamp) {
            if ((int) $timestamp > $minuteStart) {
                $inMinute[] = (int) $timestamp;
            }
        }

        if ($perMinute > 0 && count($inMinute) >= $perMinute) {
            $decision = ['allowed' => false, 'retryAfter' => max(1, 60 - ($now - min($inMinute))), 'reason' => 'minute'];
        } elseif ($perDay > 0 && count($hits) >= $perDay) {
            $oldest = min(array_map('intval', $hits));
            $decision = ['allowed' => false, 'retryAfter' => max(1, 86400 - ($now - $oldest)), 'reason' => 'day'];
        } elseif ($perMinute > 0 || $perDay > 0) {
            $hits[] = $now;
        }

        $data[$clientKey] = ['hits' => $hits, 'fails' => $fails];

        return $decision;
    });
}

/**
 * Record a failed password attempt, or report that the client is locked out.
 *
 * @return array{allowed: bool, retryAfter: int}
 */
function rl_auth_failure_gate(string $storeFile, string $clientKey): array
{
    $now = time();

    return rl_mutate($storeFile, static function (array &$data) use ($now, $clientKey): array {
        rl_prune($data);

        $bucket = isset($data[$clientKey]) && is_array($data[$clientKey])
            ? $data[$clientKey]
            : ['hits' => [], 'fails' => []];
        $hits = isset($bucket['hits']) && is_array($bucket['hits']) ? $bucket['hits'] : [];
        $windowStart = $now - AUTH_FAILURE_WINDOW;

        $fails = [];
        foreach ((isset($bucket['fails']) && is_array($bucket['fails']) ? $bucket['fails'] : []) as $timestamp) {
            if ((int) $timestamp > $windowStart) {
                $fails[] = (int) $timestamp;
            }
        }

        if (count($fails) >= AUTH_FAILURE_LIMIT) {
            $data[$clientKey] = ['hits' => $hits, 'fails' => $fails];

            return ['allowed' => false, 'retryAfter' => max(1, AUTH_FAILURE_WINDOW - ($now - min($fails)))];
        }

        $fails[] = $now;
        $data[$clientKey] = ['hits' => $hits, 'fails' => $fails];

        return ['allowed' => true, 'retryAfter' => 0];
    });
}

/** Forget accumulated password failures after a successful login. */
function rl_clear_auth_failures(string $storeFile, string $clientKey): void
{
    rl_mutate($storeFile, static function (array &$data) use ($clientKey): bool {
        rl_prune($data);

        if (isset($data[$clientKey]) && is_array($data[$clientKey])) {
            $data[$clientKey]['fails'] = [];
            if (count($data[$clientKey]['hits']) === 0) {
                unset($data[$clientKey]);
            }
        }

        return true;
    });
}

/** The bcrypt hash of the site password from gateway-config.php. */
function rl_site_password_hash(array $config): string
{
    return isset($config['SITE_PASSWORD_HASH']) && is_string($config['SITE_PASSWORD_HASH'])
        ? trim($config['SITE_PASSWORD_HASH'])
        : '';
}

/** Human-readable hint for the password gate. Sanitized for safe display. */
function rl_site_password_hint(array $config): string
{
    $hint = isset($config['SITE_PASSWORD_HINT']) && is_string($config['SITE_PASSWORD_HINT'])
        ? trim($config['SITE_PASSWORD_HINT'])
        : '';

    if ($hint === '') {
        return '';
    }

    // Allow a safe subset of HTML. Strip scripts, handlers, and unknown tags.
    $allowedTags = '<b><i><em><strong><a><br><p><span><div>';
    $hint = strip_tags($hint, $allowedTags);

    // Remove any event handlers or javascript: URLs that strip_tags misses.
    $hint = preg_replace('/\s+on\w+\s*=\s*["\'][^"\']*["\']/i', '', $hint);
    $hint = preg_replace('/href\s*=\s*["\']\s*javascript:/i', 'href="#"', $hint);

    return $hint;
}

function rl_provided_password(): string
{
    return isset($_SERVER['HTTP_X_SITE_PASSWORD']) ? (string) $_SERVER['HTTP_X_SITE_PASSWORD'] : '';
}

/** Send a JSON error and stop. */
function rl_fail(int $status, string $message, string $code, int $retryAfter = 0): void
{
    http_response_code($status);
    if ($retryAfter > 0) {
        header('Retry-After: ' . $retryAfter);
    }

    $payload = ['error' => ['message' => $message, 'code' => $code]];
    if ($retryAfter > 0) {
        $payload['error']['retryAfter'] = $retryAfter;
    }

    echo json_encode($payload);
    exit;
}

// ---------------------------------------------------------------------------
// GET ?status=1 -- lets the browser learn whether a password is required and
// whether the password it already holds is still valid. Cheap, and it never
// consumes the request budget.
// ---------------------------------------------------------------------------

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $passwordHash = rl_site_password_hash($localConfig);
    $authRequired = $passwordHash !== '';
    $authorized = true;
    $lockedOut = false;
    $retryAfter = 0;

    if ($authRequired) {
        $provided = rl_provided_password();
        $authorized = $provided !== '' && password_verify($provided, $passwordHash);

        if ($authorized) {
            try {
                rl_clear_auth_failures(rl_store_dir($localConfig) . '/buckets.json', rl_client_key($localConfig));
            } catch (Throwable $error) {
                // Losing the counter file must not block a valid login.
            }
        } elseif ($provided !== '') {
            try {
                $failure = rl_auth_failure_gate(rl_store_dir($localConfig) . '/buckets.json', rl_client_key($localConfig));
                $lockedOut = !$failure['allowed'];
                $retryAfter = $failure['retryAfter'];
            } catch (Throwable $error) {
                // Same: storage trouble must not break the status probe.
            }
        }
    }

    echo json_encode([
        'ok' => true,
        'authRequired' => $authRequired,
        'authorized' => $authorized,
        'lockedOut' => $lockedOut,
        'retryAfter' => $retryAfter,
        'limits' => [
            'perMinute' => rl_config_int($localConfig, 'RATE_LIMIT_PER_MINUTE', 3),
            'perDay' => rl_config_int($localConfig, 'RATE_LIMIT_PER_DAY', 50),
        ],
        'passwordHint' => rl_site_password_hint($localConfig),
    ]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    rl_fail(405, 'Method not allowed', 'method_not_allowed');
}

$rawInput = file_get_contents('php://input');
if ($rawInput === false || trim($rawInput) === '') {
    rl_fail(400, 'Missing JSON body', 'missing_body');
}

$input = json_decode($rawInput, true);
if (!is_array($input)) {
    rl_fail(400, 'Invalid JSON body', 'invalid_body');
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

// --- Abuse protection: optional site password + per-client rate limits ------
//
// Enforced here rather than in the browser so it cannot be bypassed by
// calling the endpoint directly. A rejected password attempt does not spend
// the request budget; only authorized requests count against 3/min, 50/day.

$clientKey = rl_client_key($localConfig);
$sitePasswordHash = rl_site_password_hash($localConfig);

if ($sitePasswordHash !== '') {
    $provided = rl_provided_password();
    if ($provided === '' || !password_verify($provided, $sitePasswordHash)) {
        try {
            $failure = rl_auth_failure_gate(rl_store_dir($localConfig) . '/buckets.json', $clientKey);
            if (!$failure['allowed']) {
                rl_fail(
                    429,
                    'Too many failed password attempts. Try again in ' . $failure['retryAfter'] . ' seconds.',
                    'auth_locked',
                    $failure['retryAfter']
                );
            }
        } catch (Throwable $error) {
            rl_fail(500, 'Rate limit storage unavailable', 'storage_error');
        }

        rl_fail(401, 'Site password required or incorrect', 'auth_required');
    }
}

try {
    $gate = rl_hit_gate(rl_store_dir($localConfig) . '/buckets.json', $clientKey, $localConfig, $sitePasswordHash !== '');
    if (!$gate['allowed']) {
        $message = $gate['reason'] === 'day'
            ? 'Daily request limit reached. Try again in ' . $gate['retryAfter'] . ' seconds.'
            : 'Request limit reached. Try again in ' . $gate['retryAfter'] . ' seconds.';
        rl_fail(429, $message, 'rate_limited', $gate['retryAfter']);
    }
} catch (Throwable $error) {
    rl_fail(500, 'Rate limit storage unavailable', 'storage_error');
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
