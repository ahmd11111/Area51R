require('dotenv').config();
const https = require('https');

// التأكد من وجود الرابط في ملف .env
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl || webhookUrl.includes('YOUR_WEBHOOK_ID')) {
    console.error('❌ Error: Please add your DISCORD_WEBHOOK_URL to the .env file first!');
    process.exit(1);
}

console.log('📤 Sending test message to Discord...');

const testEmbed = {
    embeds: [{
        title: '🧪 Test Webhook - Area 51',
        description: '✅ If you see this message, your Discord Webhook is configured correctly and ready for orders!',
        color: 0x00ff00, // لون أخضر للنجاح
        fields: [
            { name: 'Status', value: 'Active', inline: true },
            { name: 'Server', value: 'Area 51 Store', inline: true }
        ],
        footer: { text: 'Test by Area 51 Dev' },
        timestamp: new Date().toISOString()
    }]
};

try {
    const url = new URL(webhookUrl);
    const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, (res) => {
        if (res.statusCode === 204) {
            console.log('✅ Success! Check your Discord channel now.');
        } else {
            console.error('❌ Failed with status code:', res.statusCode);
        }
    });

    req.on('error', (err) => {
        console.error('❌ Network Error:', err.message);
    });

    req.write(JSON.stringify(testEmbed));
    req.end();
} catch (err) {
    console.error('❌ Exception:', err.message);
}