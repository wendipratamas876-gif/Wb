const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Serve static files (HTML, CSS, JS)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.js'));
});

// Configuration - PASTIKAN SET ENV VARIABLES DI VERCEL
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN || "8593943514:AAFP-TnIvMJ5NJFYo2oUAFxZX_-OFPt35xM",
    DO_TOKEN: process.env.DO_TOKEN || "dop_v1_8a3f89f841aeeb2fcec0df1f9b8041775332dca02658531320a7133bbd6b7f6b",
    BOT_USERNAME: process.env.BOT_USERNAME || "CloudSphereBot",
    NODE_ENV: process.env.NODE_ENV || "development"
};

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: CONFIG.NODE_ENV 
    });
});

// DigitalOcean Proxy Routes
app.get('/api/droplets', async (req, res) => {
    try {
        console.log('Fetching droplets from DigitalOcean...');
        
        const response = await axios.get('https://api.digitalocean.com/v2/droplets', {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Found ${response.data.droplets.length} droplets`);
        res.json(response.data);
    } catch (error) {
        console.error('DO API error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || 'Failed to fetch droplets'
        });
    }
});

app.post('/api/droplets', async (req, res) => {
    try {
        console.log('Creating new droplet:', req.body.name);
        
        const dropletData = {
            name: req.body.name,
            region: req.body.region,
            size: req.body.size,
            image: req.body.image,
            ssh_keys: req.body.ssh_keys || [],
            backups: req.body.backups || false,
            ipv6: req.body.ipv6 || false,
            monitoring: req.body.monitoring || false,
            user_data: req.body.user_data || null
        };
        
        const response = await axios.post(
            'https://api.digitalocean.com/v2/droplets',
            dropletData,
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Droplet created:', response.data.droplet.id);
        res.json(response.data);
    } catch (error) {
        console.error('Create droplet error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || 'Failed to create droplet'
        });
    }
});

app.post('/api/droplets/:id/actions', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        
        console.log(`Performing action ${type} on droplet ${id}`);
        
        const response = await axios.post(
            `https://api.digitalocean.com/v2/droplets/${id}/actions`,
            { type },
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`Action ${type} completed for droplet ${id}`);
        res.json(response.data);
    } catch (error) {
        console.error('Droplet action error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || 'Failed to perform action'
        });
    }
});

app.delete('/api/droplets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Deleting droplet ${id}`);
        
        await axios.delete(`https://api.digitalocean.com/v2/droplets/${id}`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
            }
        });
        
        console.log(`Droplet ${id} deleted successfully`);
        res.json({ success: true, message: 'Droplet deleted' });
    } catch (error) {
        console.error('Delete droplet error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || 'Failed to delete droplet'
        });
    }
});

// Telegram Webhook
app.post('/api/telegram/webhook', async (req, res) => {
    try {
        const update = req.body;
        
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            
            if (text === '/start') {
                // Send welcome message
                await sendTelegramMessage(chatId, 
                    '👋 Welcome to CloudSphere Bot!\n\n' +
                    'Use these commands:\n' +
                    '/register - Create new account\n' +
                    '/login - Get login credentials\n' +
                    '/help - Show help\n\n' +
                    'Visit the web dashboard to manage your VPS.'
                );
            }
            
            if (text === '/register') {
                const userId = chatId;
                const password = generatePassword();
                
                await sendTelegramMessage(chatId,
                    '✅ Account Created!\n\n' +
                    `Telegram ID: ${userId}\n` +
                    `Password: ${password}\n\n` +
                    '⚠️ Save these credentials securely!\n' +
                    'Use them to login at the web dashboard.'
                );
            }
        }
        
        res.json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper functions
async function sendTelegramMessage(chatId, text) {
    try {
        if (!CONFIG.BOT_TOKEN) {
            console.error('Bot token not configured');
            return;
        }
        
        await axios.post(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Failed to send Telegram message:', error.message);
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${CONFIG.NODE_ENV}`);
    console.log(`Bot Token Configured: ${!!CONFIG.BOT_TOKEN}`);
    console.log(`DO Token Configured: ${!!CONFIG.DO_TOKEN}`);
});

module.exports = app;const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Serve static files (HTML, CSS, JS)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.js'));
});
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Serve static files (HTML, CSS, JS)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.js'));
});

// Configuration - PASTIKAN SET ENV VARIABLES DI VERCEL
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN || "8593943514:AAFP-TnIvMJ5NJFYo2oUAFxZX_-OFPt35xM",
    DO_TOKEN: process.env.DO_TOKEN || "dop_v1_8a3f89f841aeeb2fcec0df1f9b8041775332dca02658531320a7133bbd6b7f6b",
    BOT_USERNAME: process.env.BOT_USERNAME || "CloudSphereBot",
    NODE_ENV: process.env.NODE_ENV || "development"
};

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: CONFIG.NODE_ENV 
    });
});

// DigitalOcean Proxy Routes
app.get('/api/droplets', async (req, res) => {
    try {
        console.log('Fetching droplets from DigitalOcean...');
        
        const response = await axios.get('https://api.digitalocean.com/v2/droplets', {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Found ${response.data.droplets.length} droplets`);
        res.json(response.data);
    } catch (error) {
        console.error('DO API error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || 'Failed to fetch droplets'
        });
    }
});

app.post('/api/droplets', async (req, res) => {
    try {
        console.log('Creating new droplet:', req.body.name);
        
        const dropletData = {
            name: req.body.name,
            region: req.body.region,
            size: req.body.size,
            image: req.body.image,
            ssh_keys: req.body.ssh_keys || [],
            backups: req.body.backups || false,
            ipv6: req.body.ipv6 || false,
            monitoring: req.body.monitoring || false,
            user_data: req.body.user_data || null
        };
        
        const response = await axios.post(
            'https://api.digitalocean.com/v2/droplets',
            dropletData,
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Droplet created:', response.data.droplet.id);
        res.json(response.data);
    } catch (error) {
        console.error('Create droplet error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || 'Failed to create droplet'
        });
    }
});

app.post('/api/droplets/:id/actions', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        
        console.log(`Performing action ${type} on droplet ${id}`);
        
        const response = await axios.post(
            `https://api.digitalocean.com/v2/droplets/${id}/actions`,
            { type },
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`Action ${type} completed for droplet ${id}`);
        res.json(response.data);
    } catch (error) {
        console.error('Droplet action error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || 'Failed to perform action'
        });
    }
});

app.delete('/api/droplets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Deleting droplet ${id}`);
        
        await axios.delete(`https://api.digitalocean.com/v2/droplets/${id}`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
            }
        });
        
        console.log(`Droplet ${id} deleted successfully`);
        res.json({ success: true, message: 'Droplet deleted' });
    } catch (error) {
        console.error('Delete droplet error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || 'Failed to delete droplet'
        });
    }
});

// Telegram Webhook
app.post('/api/telegram/webhook', async (req, res) => {
    try {
        const update = req.body;
        
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            
            if (text === '/start') {
                // Send welcome message
                await sendTelegramMessage(chatId, 
                    '👋 Welcome to CloudSphere Bot!\n\n' +
                    'Use these commands:\n' +
                    '/register - Create new account\n' +
                    '/login - Get login credentials\n' +
                    '/help - Show help\n\n' +
                    'Visit the web dashboard to manage your VPS.'
                );
            }
            
            if (text === '/register') {
                const userId = chatId;
                const password = generatePassword();
                
                await sendTelegramMessage(chatId,
                    '✅ Account Created!\n\n' +
                    `Telegram ID: ${userId}\n` +
                    `Password: ${password}\n\n` +
                    '⚠️ Save these credentials securely!\n' +
                    'Use them to login at the web dashboard.'
                );
            }
        }
        
        res.json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper functions
async function sendTelegramMessage(chatId, text) {
    try {
        if (!CONFIG.BOT_TOKEN) {
            console.error('Bot token not configured');
            return;
        }
        
        await axios.post(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Failed to send Telegram message:', error.message);
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${CONFIG.NODE_ENV}`);
    console.log(`Bot Token Configured: ${!!CONFIG.BOT_TOKEN}`);
    console.log(`DO Token Configured: ${!!CONFIG.DO_TOKEN}`);
});

module.exports = app;
// Configuration - PASTIKAN SET ENV VARIABLES DI VERCEL
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN || "8593943514:AAFP-TnIvMJ5NJFYo2oUAFxZX_-OFPt35xM",
    DO_TOKEN: process.env.DO_TOKEN || "dop_v1_8a3f89f841aeeb2fcec0df1f9b8041775332dca02658531320a7133bbd6b7f6b",
    BOT_USERNAME: process.env.BOT_USERNAME || "CloudSphereBot",
    NODE_ENV: process.env.NODE_ENV || "development"
};

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: CONFIG.NODE_ENV 
    });
});

// DigitalOcean Proxy Routes
app.get('/api/droplets', async (req, res) => {
    try {
        console.log('Fetching droplets from DigitalOcean...');
        
        const response = await axios.get('https://api.digitalocean.com/v2/droplets', {
            headers: {
            }
        }
        
        res.json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper functions
async function sendTelegramMessage(chatId, text) {
    try {
        if (!CONFIG.BOT_TOKEN) {
            console.error('Bot token not configured');
            return;
        }
        
        await axios.post(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Failed to send Telegram message:', error.message);
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${CONFIG.NODE_ENV}`);
    console.log(`Bot Token Configured: ${!!CONFIG.BOT_TOKEN}`);
    console.log(`DO Token Configured: ${!!CONFIG.DO_TOKEN}`);
});

module.exports = app;
