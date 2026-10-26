<?php
// Copy this file to gateway-config.php and set your server-side OpenRouter key.
// Do not commit gateway-config.php.

return [
    'OPENROUTER_API_KEY' => '',
    'OPENROUTER_API_BASE' => 'https://openrouter.ai/api/v1',

    // Optional: pin the model the gateway uses when the client sends none.
    // Free slug so a bare prompt does not spend credits.
    'OPENROUTER_MODEL' => 'google/gemma-4-26b-a4b-it:free',

    // --- Abuse protection ---------------------------------------------------
    // Requests allowed per client IP. Set either to 0 to disable that window.
    // Counters are pruned continuously, so the day window is a rolling 24h.
    'RATE_LIMIT_PER_MINUTE' => 3,
    'RATE_LIMIT_PER_DAY' => 50,

    // Where the JSON counters live. Defaults to a 'var/rate-limit' directory
    // beside the deploy target (so redeploys do not wipe the counters), and
    // falls back to the system temp dir. Point this outside the web root so
    // the counter file is never fetchable.
    // 'RATE_LIMIT_DIR' => '/home/lightcatorg/apps/chineseqa/var/rate-limit',

    // Optional shared site password. Generate the hash with:
    //   php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
    // Leave empty to leave the site open; rate limiting still applies.
    'SITE_PASSWORD_HASH' => '',

    // Optional human-readable hint shown in the password gate overlay.
    // Can include basic HTML (b, i, em, strong, a with href). Stripped of
    // scripts, event handlers, and unknown tags. Empty = default message.
    'SITE_PASSWORD_HINT' => '',

    // Set true only when a trusted reverse proxy sets X-Forwarded-For.
    // Otherwise the rate limiter keys on the direct connection address, which
    // is correct when Caddy is the edge and the client cannot spoof it.
    'TRUST_PROXY' => false,
];
