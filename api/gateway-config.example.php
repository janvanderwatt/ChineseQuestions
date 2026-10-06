<?php
// Copy this file to gateway-config.php and set your server-side OpenRouter key.
// Do not commit gateway-config.php.

return [
    'OPENROUTER_API_KEY' => '',
    'OPENROUTER_API_BASE' => 'https://openrouter.ai/api/v1',

    // Optional: pin the model the gateway uses when the client sends none.
    // Free slug so a bare prompt does not spend credits.
    'OPENROUTER_MODEL' => 'google/gemma-4-26b-a4b-it:free',
];
