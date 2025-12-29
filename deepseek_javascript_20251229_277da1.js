const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    DO_TOKEN: process.env.DO_TOKEN,
    BOT_USERNAME: process.env.BOT_USERNAME || 'CloudSphereBot'
};

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Telegram Webhook (untuk handle registration)
app.post('/api/telegram-webhook', async (req, res) => {
    try {
        const update = req.body;
        
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            
            // Handle /start command
            if (text === '/start') {
                await sendTelegramMessage(chatId, 
                    '👋 Welcome to CloudSphere Bot!\n\n' +
                    'Use these commands:\n' +
                    '/register - Create new account\n' +
                    '/login - Get login credentials\n' +
                    '/help - Show help\n\n' +
                    'Visit: https://yourdomain.com'
                );
            }
            
            // Handle /register command
            if (text === '/register') {
                // Generate random credentials
                const userId = chatId;
                const password = generatePassword();
                
                // Save to database (in production)
                // For demo, just return credentials
                
                await sendTelegramMessage(chatId,
                    '✅ Account Created!\n\n' +
                    `Telegram ID: ${userId}\n` +
                    `Password: ${password}\n\n` +
                    'Login at: https://yourdomain.com\n\n' +
                    '⚠️ Save these credentials securely!'
                );
            }
        }
        
        res.json({ ok: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DigitalOcean Proxy (secure API calls)
app.get('/api/droplets', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const response = await axios.get('https://api.digitalocean.com/v2/droplets', {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('DO API error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || error.message
        });
    }
});

app.post('/api/droplets', async (req, res) => {
    try {
        const response = await axios.post('https://api.digitalocean.com/v2/droplets', req.body, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Create droplet error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || error.message
        });
    }
});

app.post('/api/droplets/:id/actions', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.post(
            `https://api.digitalocean.com/v2/droplets/${id}/actions`,
            req.body,
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Droplet action error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || error.message
        });
    }
});

app.delete('/api/droplets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await axios.delete(`https://api.digitalocean.com/v2/droplets/${id}`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
            }
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete droplet error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || error.message
        });
    }
});

// Helper functions
async function sendTelegramMessage(chatId, text) {
    try {
        await axios.post(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Telegram send error:', error.message);
    }
}

function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;