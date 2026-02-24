require('dotenv').config();
const axios = require('axios');

module.exports = async (req, res) => {
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    
    if (!TELEGRAM_TOKEN) {
        return res.status(400).json({ error: 'TELEGRAM_TOKEN not set' });
    }
    
    // Get the webhook URL from query or use VERCEL_URL env
    let webhookUrl = req.query.url || process.env.VERCEL_URL;
    
    if (!webhookUrl) {
        return res.status(400).json({ 
            error: 'No webhook URL provided',
            hint: 'Add ?url=https://your-app.vercel.app/api/webhook or set VERCEL_URL env var'
        });
    }
    
    // Ensure it's a full URL
    if (!webhookUrl.startsWith('http')) {
        webhookUrl = `https://${webhookUrl}/api/webhook`;
    }
    
    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`,
            { url: webhookUrl }
        );
        
        res.status(200).json({
            success: true,
            webhook_url: webhookUrl,
            telegram_response: response.data
        });
    } catch (e) {
        res.status(500).json({
            success: false,
            error: e.message
        });
    }
};
