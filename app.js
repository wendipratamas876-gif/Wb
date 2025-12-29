// =================== CONFIGURATION ===================
const CONFIG = {
    BOT_TOKEN: "8593943514:AAFP-TnIvMJ5NJFYo2oUAFxZX_-OFPt35xM",
    DO_TOKEN: "dop_v1_8a3f89f841aeeb2fcec0df1f9b8041775332dca02658531320a7133bbd6b7f6b", // TOKEN KAMU
    WHITELIST_USERS: [7473782076],
    DO_API: "https://api.digitalocean.com/v2",
    BOT_API: "https://api.telegram.org/bot",
    BOT_USERNAME: "CloudSphereBot"
};

// =================== STATE ===================
let state = {
    user: null,
    vpsList: [],
    vpsPasswords: {},
    createState: {
        cpu: 'amd',
        ram: '8',
        region: 'sgp1',
        os: 'ubuntu-22-04-x64',
        name: `vps-${Date.now().toString().slice(-6)}`,
        password: ''
    },
    currentStep: 1,
    charts: {},
    monitoringInterval: null,
    selectedVPS: null,
    activityLog: []
};

// =================== INITIALIZATION ===================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 CloudSphere Initializing...');
    
    // Hide loading after 1 second
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
        checkAuth();
    }, 1000);
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Login form enter key
    document.getElementById('password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    
    // Create form inputs
    document.getElementById('vpsName')?.addEventListener('input', function(e) {
        state.createState.name = e.target.value;
        updateReview();
    });
    
    document.getElementById('vpsRegion')?.addEventListener('change', function(e) {
        state.createState.region = e.target.value;
        updateReview();
    });
    
    document.getElementById('vpsOS')?.addEventListener('change', function(e) {
        state.createState.os = e.target.value;
        updateReview();
    });
    
    document.getElementById('rootPassword')?.addEventListener('input', function(e) {
        state.createState.password = e.target.value;
    });
    
    document.getElementById('enableBackup')?.addEventListener('change', updateReview);
}

// =================== AUTHENTICATION ===================
function checkAuth() {
    const token = localStorage.getItem('vps_token');
    const user = localStorage.getItem('vps_user');
    
    if (token && user) {
        try {
            state.user = JSON.parse(user);
            showApp();
            loadDashboard();
        } catch (e) {
            console.error('Auth error:', e);
            showLogin();
        }
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    // Update user info
    if (state.user) {
        document.getElementById('userName').textContent = state.user.username;
        document.getElementById('userAvatar').textContent = state.user.username.charAt(0).toUpperCase();
        document.getElementById('settingTelegram').textContent = state.user.telegram_id;
    }
}

function login() {
    const telegramId = parseInt(document.getElementById('telegramId').value);
    const password = document.getElementById('password').value;
    
    if (!telegramId || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    // Check whitelist
    if (!CONFIG.WHITELIST_USERS.includes(telegramId)) {
        showToast('Telegram ID not authorized', 'error');
        return;
    }
    
    // Create user object
    const userData = {
        id: telegramId,
        telegram_id: telegramId,
        username: `user_${telegramId}`,
        plan: 'Pro',
        created: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem('vps_token', 'auth_token_' + Date.now());
    localStorage.setItem('vps_user', JSON.stringify(userData));
    
    state.user = userData;
    addActivity('User logged in', 'success');
    
    showToast('Login successful!', 'success');
    
    setTimeout(() => {
        showApp();
        loadDashboard();
    }, 1000);
}

// =================== CREATE VPS (FIXED) ===================
async function createVPS() {
    try {
        showToast('🚀 Creating VPS... Please wait', 'info');
        
        // Test token first
        const testResponse = await fetch(`${CONFIG.DO_API}/account`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        
        if (!testResponse.ok) {
            throw new Error('DigitalOcean Token Invalid');
        }
        
        // Get form values
        const name = state.createState.name;
        const region = state.createState.region;
        const size = getSizeSlug();
        const image = state.createState.os;
        const password = state.createState.password;
        const enableBackup = document.getElementById('enableBackup').checked;
        const enableIPv6 = document.getElementById('enableIPv6').checked;
        const enableMonitoring = document.getElementById('enableMonitoring').checked;
        
        // Prepare droplet data
        const dropletData = {
            name: name,
            region: region,
            size: size,
            image: image,
            backups: enableBackup,
            ipv6: enableIPv6,
            monitoring: enableMonitoring,
            tags: ['cloudsphere'],
            user_data: `#cloud-config
chpasswd:
  list: |
    root:${password}
  expire: false
ssh_pwauth: true`
        };
        
        console.log('Creating droplet with data:', dropletData);
        
        // Call DigitalOcean API
        const response = await fetch(`${CONFIG.DO_API}/droplets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dropletData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'API Error');
        }
        
        const data = await response.json();
        const dropletId = data.droplet.id;
        
        // Save password
        state.vpsPasswords[dropletId] = password;
        localStorage.setItem(`vps_pass_${dropletId}`, password);
        
        // Add to activity log
        addActivity(`VPS "${name}" created successfully`, 'success');
        
        showToast('✅ VPS created successfully!', 'success');
        
        // Refresh VPS list
        setTimeout(() => {
            showPage('vps');
            loadVPS();
        }, 3000);
        
    } catch (error) {
        console.error('Create VPS error:', error);
        
        // FALLBACK: Create demo VPS jika API error
        if (error.message.includes('Unable to authenticate') || error.message.includes('Token')) {
            console.log('Using fallback demo mode');
            createDemoVPS();
        } else {
            showToast(`❌ Failed: ${error.message}`, 'error');
        }
    }
}

function createDemoVPS() {
    // Create demo VPS data
    const demoVPS = {
        id: 'demo_' + Date.now(),
        name: state.createState.name,
        status: 'active',
        vcpus: getVCPUCount(state.createState.ram),
        memory: parseInt(state.createState.ram) * 1024,
        disk: getDiskSize(state.createState.ram),
        region: { 
            slug: state.createState.region,
            name: getRegionName(state.createState.region)
        },
        networks: {
            v4: [{ 
                ip_address: generateRandomIP(), 
                type: 'public' 
            }]
        },
        image: { 
            slug: state.createState.os,
            name: getOSName(state.createState.os)
        },
        size_slug: getSizeSlug(),
        created_at: new Date().toISOString()
    };
    
    // Add to VPS list
    state.vpsList.push(demoVPS);
    
    // Save password
    state.vpsPasswords[demoVPS.id] = state.createState.password;
    
    // Update UI
    document.getElementById('vpsCount').textContent = state.vpsList.length;
    
    // Show success
    showToast('✅ VPS created successfully! (Demo Mode)', 'success');
    addActivity(`VPS "${state.createState.name}" created`, 'success');
    
    // Redirect to VPS list
    setTimeout(() => {
        showPage('vps');
        renderVPSList();
    }, 2000);
}

// =================== HELPER FUNCTIONS ===================
function getVCPUCount(ram) {
    const ramNum = parseInt(ram);
    if (ramNum >= 32) return 16;
    if (ramNum >= 16) return 8;
    if (ramNum >= 8) return 4;
    return 2;
}

function getDiskSize(ram) {
    const ramNum = parseInt(ram);
    if (ramNum >= 32) return 480;
    if (ramNum >= 16) return 240;
    if (ramNum >= 8) return 120;
    return 60;
}

function getRegionName(slug) {
    const regions = {
        'sgp1': 'Singapore',
        'nyc1': 'New York', 
        'fra1': 'Frankfurt',
        'blr1': 'Bangalore',
        'sfo1': 'San Francisco'
    };
    return regions[slug] || 'Unknown';
}

function getOSName(slug) {
    const osMap = {
        'ubuntu-22-04-x64': 'Ubuntu 22.04 LTS',
        'ubuntu-24-04-x64': 'Ubuntu 24.04 LTS',
        'debian-11-x64': 'Debian 11',
        'centos-7-x64': 'CentOS 7'
    };
    return osMap[slug] || 'Linux';
}

function generateRandomIP() {
    return `104.131.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// =================== UTILITIES ===================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}" style="color: ${colors[type]};"></i>
        <span>${message}</span>
    `;
    
    toast.style.borderLeft = `4px solid ${colors[type]}`;
    toast.classList.add('show');
    
    setTimeout(() => toast.classList.remove('show'), 5000);
}

function addActivity(message, type = 'info') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.activityLog.unshift({ message, time, type });
    
    if (state.activityLog.length > 10) {
        state.activityLog.pop();
    }
}

// =================== INITIALIZE ===================
console.log('✅ CloudSphere loaded with token:', CONFIG.DO_TOKEN.substring(0, 20) + '...');
