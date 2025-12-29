const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// =================== CONFIGURATION ===================
const CONFIG = {
    // Token dari Environment Variables (Railway)
    BOT_TOKEN: process.env.BOT_TOKEN || "8593943514:AAFP-TnIvMJ5NJFYo2oUAFxZX_-OFPt35xM",
    DO_TOKEN: process.env.DO_TOKEN || "dop_v1_8a3f89f841aeeb2fcec0df1f9b8041775332dca02658531320a7133bbd6b7f6b",
    BOT_USERNAME: process.env.BOT_USERNAME || "CloudSphereBot",
    WHITELIST_USERS: process.env.WHITELIST_USERS ? process.env.WHITELIST_USERS.split(',').map(Number) : [7473782076],
    JWT_SECRET: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this",
    NODE_ENV: process.env.NODE_ENV || "production",
    PORT: process.env.PORT || 3000
};

// =================== MIDDLEWARE ===================
app.use(cors({
    origin: '*', // Bisa diganti dengan domain spesifik
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.')); // Serve semua file static dari root

// =================== TELEGRAM BOT UTILS ===================
async function sendTelegramMessage(chatId, text) {
    try {
        if (!CONFIG.BOT_TOKEN || CONFIG.BOT_TOKEN === "YOUR_BOT_TOKEN_HERE") {
            console.warn('Bot token not configured, skipping Telegram message');
            return null;
        }
        
        const response = await axios.post(
            `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`,
            {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );
        
        return response.data;
    } catch (error) {
        console.error('Telegram API Error:', error.response?.data || error.message);
        return null;
    }
}

function generatePassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// =================== ROUTES ===================

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'VPS Manager API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: CONFIG.NODE_ENV,
        features: {
            digitalocean: !!CONFIG.DO_TOKEN,
            telegram: !!CONFIG.BOT_TOKEN
        }
    });
});

// Serve Frontend
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'index.html'));
    } catch (error) {
        res.status(500).send('Error loading frontend');
    }
});

// Get all VPS
app.get('/api/vps', async (req, res) => {
    try {
        console.log('📡 Fetching droplets from DigitalOcean...');
        
        const response = await axios.get('https://api.digitalocean.com/v2/droplets', {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        
        console.log(`✅ Found ${response.data.droplets?.length || 0} droplets`);
        
        res.json({
            success: true,
            count: response.data.droplets?.length || 0,
            droplets: response.data.droplets || []
        });
        
    } catch (error) {
        console.error('❌ DigitalOcean API Error:', {
            status: error.response?.status,
            data: error.response?.data
        });
        
        // Return demo data if API fails
        res.json({
            success: false,
            message: 'Using demo data',
            count: 3,
            droplets: getDemoDroplets(),
            demo: true
        });
    }
});

// Create VPS
app.post('/api/vps/create', async (req, res) => {
    try {
        const {
            name,
            region = 'sgp1',
            size = 's-2vcpu-4gb-amd',
            image = 'ubuntu-22-04-x64',
            ssh_keys = [],
            backups = false,
            ipv6 = true,
            monitoring = true,
            tags = ['vps-manager'],
            user_data = null
        } = req.body;

        console.log('🚀 Creating new droplet:', { name, region, size, image });

        // Validate required fields
        if (!name || !region || !size || !image) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, region, size, image'
            });
        }

        // Prepare droplet data
        const dropletData = {
            name,
            region,
            size,
            image,
            ssh_keys,
            backups,
            ipv6,
            monitoring,
            tags,
            ...(user_data && { user_data })
        };

        console.log('📦 Droplet data:', JSON.stringify(dropletData, null, 2));

        // Call DigitalOcean API
        const response = await axios.post(
            'https://api.digitalocean.com/v2/droplets',
            dropletData,
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 seconds timeout for creation
            }
        );

        console.log('✅ Droplet created successfully:', response.data.droplet.id);

        // Send notification to Telegram if configured
        if (CONFIG.BOT_TOKEN && req.body.telegram_id) {
            await sendTelegramMessage(req.body.telegram_id,
                `🎉 VPS Created Successfully!\n\n` +
                `Name: ${name}\n` +
                `Region: ${region}\n` +
                `Size: ${size}\n` +
                `Status: Active\n\n` +
                `IP: ${response.data.droplet.networks?.v4?.[0]?.ip_address || 'Pending'}\n` +
                `Password: ${req.body.password ? 'Check your dashboard' : 'SSH key configured'}`
            );
        }

        res.json({
            success: true,
            message: 'VPS created successfully',
            droplet: response.data.droplet,
            action_id: response.data.droplet.id
        });

    } catch (error) {
        console.error('❌ Create VPS Error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });

        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || 'Failed to create VPS',
            details: error.response?.data || error.message
        });
    }
});

// VPS Actions (start, stop, reboot, etc)
app.post('/api/vps/:id/action', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        if (!['power_on', 'power_off', 'reboot', 'shutdown', 'power_cycle'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid action. Use: power_on, power_off, reboot, shutdown, power_cycle'
            });
        }

        console.log(`⚡ Performing ${action} on droplet ${id}`);

        const response = await axios.post(
            `https://api.digitalocean.com/v2/droplets/${id}/actions`,
            { type: action },
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ Action ${action} completed for droplet ${id}`);

        res.json({
            success: true,
            message: `Action ${action} executed successfully`,
            action: response.data.action
        });

    } catch (error) {
        console.error('❌ VPS Action Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || 'Failed to perform action'
        });
    }
});

// Delete VPS
app.delete('/api/vps/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ Deleting droplet ${id}`);

        await axios.delete(`https://api.digitalocean.com/v2/droplets/${id}`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
            }
        });

        console.log(`✅ Droplet ${id} deleted successfully`);

        res.json({
            success: true,
            message: 'VPS deleted successfully'
        });

    } catch (error) {
        console.error('❌ Delete VPS Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || 'Failed to delete VPS'
        });
    }
});

// Telegram Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { telegram_id, username } = req.body;

        if (!telegram_id) {
            return res.status(400).json({
                success: false,
                error: 'Telegram ID is required'
            });
        }

        // Check if user is whitelisted
        if (!CONFIG.WHITELIST_USERS.includes(parseInt(telegram_id))) {
            return res.status(403).json({
                success: false,
                error: 'Your Telegram ID is not whitelisted. Contact administrator.'
            });
        }

        // Generate credentials
        const password = generatePassword();
        const token = require('crypto').randomBytes(32).toString('hex');

        // Save user to database (in production)
        // For demo, return credentials directly
        const userData = {
            id: telegram_id,
            username: username || `user_${telegram_id}`,
            telegram_id: telegram_id,
            created_at: new Date().toISOString(),
            plan: 'pro',
            token: token
        };

        // Send credentials via Telegram
        if (CONFIG.BOT_TOKEN) {
            await sendTelegramMessage(telegram_id,
                `🔐 Account Created Successfully!\n\n` +
                `Username: ${userData.username}\n` +
                `Password: ${password}\n\n` +
                `Login at: ${req.headers.origin || 'https://your-domain.com'}\n\n` +
                `⚠️ Save these credentials securely!\n` +
                `You will need them to login.`
            );
        }

        res.json({
            success: true,
            message: 'Registration successful. Check Telegram for credentials.',
            user: {
                id: userData.id,
                username: userData.username,
                telegram_id: userData.telegram_id,
                plan: userData.plan
            }
        });

    } catch (error) {
        console.error('❌ Registration Error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { telegram_id, password } = req.body;

        if (!telegram_id || !password) {
            return res.status(400).json({
                success: false,
                error: 'Telegram ID and password are required'
            });
        }

        // In production, verify against database
        // For demo, accept any whitelisted user with "password123"
        if (!CONFIG.WHITELIST_USERS.includes(parseInt(telegram_id))) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { 
                id: telegram_id, 
                username: `user_${telegram_id}`,
                plan: 'pro'
            },
            CONFIG.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: telegram_id,
                username: `user_${telegram_id}`,
                telegram_id: telegram_id,
                plan: 'pro'
            }
        });

    } catch (error) {
        console.error('❌ Login Error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Telegram Webhook (for bot registration)
app.post('/api/telegram/webhook', async (req, res) => {
    try {
        const update = req.body;

        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            const username = update.message.from.username || update.message.from.first_name;

            console.log(`📱 Telegram message from ${chatId}: ${text}`);

            if (text === '/start') {
                await sendTelegramMessage(chatId,
                    `👋 Welcome to CloudSphere VPS Manager!\n\n` +
                    `I'm your assistant bot for managing VPS servers.\n\n` +
                    `📋 Available Commands:\n` +
                    `/register - Create new account\n` +
                    `/login - Get login link\n` +
                    `/help - Show help\n\n` +
                    `🌐 Web Dashboard: ${req.headers.origin || 'https://your-domain.com'}\n\n` +
                    `Need help? Contact support.`
                );
            }

            if (text === '/register') {
                // Check if user is whitelisted
                if (CONFIG.WHITELIST_USERS.includes(chatId)) {
                    const password = generatePassword();
                    
                    await sendTelegramMessage(chatId,
                        `✅ Registration Complete!\n\n` +
                        `Your Account Details:\n` +
                        `Telegram ID: ${chatId}\n` +
                        `Username: user_${chatId}\n` +
                        `Password: ${password}\n\n` +
                        `🌐 Login at: ${req.headers.origin || 'https://your-domain.com'}\n\n` +
                        `⚠️ Important:\n` +
                        `1. Save these credentials\n` +
                        `2. Login to web dashboard\n` +
                        `3. Start creating VPS servers!\n\n` +
                        `Need help? Use /help`
                    );
                } else {
                    await sendTelegramMessage(chatId,
                        `⛔ Access Denied\n\n` +
                        `Your Telegram ID (${chatId}) is not whitelisted.\n\n` +
                        `Please contact the administrator to get access.\n\n` +
                        `You need to be added to the whitelist first.`
                    );
                }
            }

            if (text === '/help') {
                await sendTelegramMessage(chatId,
                    `🆘 Help & Support\n\n` +
                    `How to use:\n` +
                    `1. Use /register to create account\n` +
                    `2. Get your credentials\n` +
                    `3. Login at web dashboard\n` +
                    `4. Create and manage VPS servers\n\n` +
                    `📞 Support:\n` +
                    `- Report issues\n` +
                    `- Feature requests\n` +
                    `- General questions\n\n` +
                    `🌐 Web Dashboard: ${req.headers.origin || 'https://your-domain.com'}`
                );
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Telegram Webhook Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Regions
app.get('/api/regions', async (req, res) => {
    try {
        const response = await axios.get('https://api.digitalocean.com/v2/regions', {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
            }
        });

        res.json({
            success: true,
            regions: response.data.regions.filter(r => r.available)
        });
    } catch (error) {
        // Return default regions if API fails
        res.json({
            success: true,
            regions: [
                { slug: 'sgp1', name: 'Singapore', available: true },
                { slug: 'nyc1', name: 'New York', available: true },
                { slug: 'fra1', name: 'Frankfurt', available: true },
                { slug: 'blr1', name: 'Bangalore', available: true },
                { slug: 'sfo1', name: 'San Francisco', available: true }
            ],
            demo: true
        });
    }
});

// Get Sizes (AMD/Intel)
app.get('/api/sizes', async (req, res) => {
    try {
        const response = await axios.get('https://api.digitalocean.com/v2/sizes', {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
            }
        });

        // Filter AMD and Intel sizes
        const amdSizes = response.data.sizes.filter(size => 
            size.slug.includes('amd') && size.available
        );
        const intelSizes = response.data.sizes.filter(size => 
            size.slug.includes('intel') && size.available
        );

        res.json({
            success: true,
            amd: amdSizes,
            intel: intelSizes
        });
    } catch (error) {
        // Return default sizes
        res.json({
            success: true,
            amd: [
                { slug: 's-2vcpu-4gb-amd', memory: 4096, vcpus: 2, disk: 80, price_monthly: 20 },
                { slug: 's-4vcpu-8gb-amd', memory: 8192, vcpus: 4, disk: 160, price_monthly: 40 },
                { slug: 's-8vcpu-16gb-amd', memory: 16384, vcpus: 8, disk: 320, price_monthly: 80 }
            ],
            intel: [
                { slug: 's-2vcpu-4gb-intel', memory: 4096, vcpus: 2, disk: 80, price_monthly: 24 },
                { slug: 's-4vcpu-8gb-intel', memory: 8192, vcpus: 4, disk: 160, price_monthly: 48 },
                { slug: 's-8vcpu-16gb-intel', memory: 16384, vcpus: 8, disk: 320, price_monthly: 96 }
            ],
            demo: true
        });
    }
});

// Helper: Demo data for fallback
function getDemoDroplets() {
    return [
        {
            id: 123456789,
            name: 'web-server-1',
            memory: 4096,
            vcpus: 2,
            disk: 80,
            status: 'active',
            locked: false,
            created_at: '2024-01-15T10:30:00Z',
            features: ['backups', 'ipv6'],
            region: { slug: 'sgp1', name: 'Singapore' },
            size_slug: 's-2vcpu-4gb-amd',
            networks: {
                v4: [
                    { ip_address: '192.168.1.1', type: 'private' },
                    { ip_address: '104.131.186.241', type: 'public' }
                ]
            },
            image: { distribution: 'Ubuntu', name: 'Ubuntu 22.04 LTS' }
        },
        {
            id: 987654321,
            name: 'db-cluster',
            memory: 8192,
            vcpus: 4,
            disk: 160,
            status: 'active',
            locked: false,
            created_at: '2024-02-20T14:45:00Z',
            features: ['backups', 'ipv6', 'monitoring'],
            region: { slug: 'nyc1', name: 'New York' },
            size_slug: 's-4vcpu-8gb-intel',
            networks: {
                v4: [
                    { ip_address: '10.0.0.5', type: 'private' },
                    { ip_address: '138.197.192.241', type: 'public' }
                ]
            },
            image: { distribution: 'Ubuntu', name: 'Ubuntu 24.04 LTS' }
        },
        {
            id: 456789123,
            name: 'dev-server',
            memory: 1024,
            vcpus: 1,
            disk: 25,
            status: 'off',
            locked: false,
            created_at: '2024-03-10T09:15:00Z',
            features: ['ipv6'],
            region: { slug: 'fra1', name: 'Frankfurt' },
            size_slug: 's-1vcpu-1gb',
            networks: {
                v4: [
                    { ip_address: '192.168.2.10', type: 'private' },
                    { ip_address: '165.227.93.89', type: 'public' }
                ]
            },
            image: { distribution: 'Debian', name: 'Debian 11' }
        }
    ];
}

// =================== ERROR HANDLING ===================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    console.error('🚨 Server Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: CONFIG.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// =================== START SERVER ===================
const PORT = CONFIG.PORT;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 VPS Manager Server Started!
    ===============================
    📍 Port: ${PORT}
    🌍 Environment: ${CONFIG.NODE_ENV}
    🤖 Bot: ${CONFIG.BOT_USERNAME}
    💾 Storage: DigitalOcean API
    🔒 Whitelist Users: ${CONFIG.WHITELIST_USERS.length}
    
    📊 Endpoints:
    - http://localhost:${PORT}/          → Frontend
    - http://localhost:${PORT}/health    → Health Check
    - http://localhost:${PORT}/api/vps   → Get VPS List
    - http://localhost:${PORT}/api/vps/create → Create VPS
    
    ⚠️  Important:
    1. Set BOT_TOKEN, DO_TOKEN in environment
    2. Add your Telegram ID to WHITELIST_USERS
    3. Access the web interface to get started
    `);
});

module.exports = app;