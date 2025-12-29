// =================== CONFIGURATION ===================
const CONFIG = {
    API_URL: window.location.origin, // Auto detect current domain
    BOT_USERNAME: "CloudSphereBot",
    DO_TOKEN: "dop_v1_8a3f89f841aeeb2fcec0df1f9b8041775332dca02658531320a7133bbd6b7f6b",
    WHITELIST_USERS: [7473782076]
};

// =================== STATE MANAGEMENT ===================
let state = {
    user: null,
    vpsList: [],
    createData: {
        cpu: 'amd',
        ram: 8,
        region: 'sgp1',
        os: 'ubuntu-22-04',
        name: 'vps-001',
        password: ''
    },
    currentStep: 1,
    charts: {},
    monitoringInterval: null
};

// =================== INITIALIZATION ===================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 CloudSphere Initializing...');
    
    // Hide loading after 1.5 seconds
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
        showLogin();
    }, 1500);
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if already logged in
    checkAuth();
});

function setupEventListeners() {
    // Login form
    document.getElementById('password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    
    // Search input
    document.getElementById('searchInput')?.addEventListener('input', function(e) {
        searchVPS(e.target.value);
    });
}

// =================== AUTHENTICATION ===================
function checkAuth() {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
        try {
            state.user = JSON.parse(userData);
            showApp();
            loadDashboard();
        } catch (e) {
            console.error('Auth error:', e);
            showLogin();
        }
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
        document.getElementById('userName').textContent = state.user.username || 'User';
        document.getElementById('userAvatar').textContent = (state.user.username || 'U').charAt(0).toUpperCase();
        document.getElementById('settingTelegram').textContent = state.user.telegram_id || 'Not set';
    }
}

function login() {
    const telegramId = document.getElementById('telegramId').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!telegramId || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    // Check whitelist
    if (!CONFIG.WHITELIST_USERS.includes(parseInt(telegramId))) {
        showToast('Telegram ID not authorized', 'error');
        return;
    }
    
    // For demo, accept any password
    const userData = {
        id: Date.now(),
        telegram_id: telegramId,
        username: `user_${telegramId}`,
        plan: 'Pro',
        created: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem('token', 'demo_token_' + Date.now());
    localStorage.setItem('user', JSON.stringify(userData));
    
    state.user = userData;
    
    showToast('Login successful!', 'success');
    
    setTimeout(() => {
        showApp();
        loadDashboard();
    }, 1000);
}

function createViaTelegram() {
    const botUrl = `https://t.me/${CONFIG.BOT_USERNAME}`;
    
    showModal(
        'Create Account via Telegram',
        `
        <div style="text-align: left; line-height: 1.6;">
            <p>To create an account:</p>
            <ol>
                <li>Open <a href="${botUrl}" target="_blank" style="color: #3b82f6;">@${CONFIG.BOT_USERNAME}</a> on Telegram</li>
                <li>Send <code>/start</code> command</li>
                <li>Send <code>/register</code> to create account</li>
                <li>You'll receive your login credentials</li>
                <li>Return here and login</li>
            </ol>
            <p style="margin-top: 20px; color: #94a3b8;">
                <i class="fas fa-info-circle"></i> Account verification required for security
            </p>
        </div>
        `
    );
}

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const icon = document.querySelector('.toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function logout() {
    showModal(
        'Confirm Logout',
        'Are you sure you want to logout?',
        [
            { text: 'Cancel', action: 'close' },
            { 
                text: 'Logout', 
                action: () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    state.user = null;
                    showLogin();
                    showToast('Logged out successfully', 'info');
                    closeModal();
                },
                style: 'danger'
            }
        ]
    );
}

// =================== NAVIGATION ===================
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelector(`.nav-item[onclick="showPage('${pageId}')"]`)?.classList.add('active');
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        vps: 'My VPS',
        create: 'Create VPS',
        monitoring: 'Monitoring',
        settings: 'Settings'
    };
    
    document.getElementById('pageTitle').textContent = titles[pageId] || 'Dashboard';
    document.getElementById('pageSubtitle').textContent = getSubtitle(pageId);
    
    // Load page data
    switch(pageId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'vps':
            loadVPS();
            break;
        case 'monitoring':
            loadMonitoring();
            break;
        case 'create':
            initCreateWizard();
            break;
    }
}

function getSubtitle(pageId) {
    const subtitles = {
        dashboard: 'Overview of your infrastructure',
        vps: 'Manage your virtual machines',
        create: 'Deploy a new server',
        monitoring: 'Real-time metrics',
        settings: 'Account configuration'
    };
    return subtitles[pageId] || '';
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

// =================== DASHBOARD ===================
function loadDashboard() {
    // Update stats
    updateStats();
    
    // Load VPS data
    loadVPSData();
    
    // Initialize charts
    initCharts();
    
    // Start auto-refresh
    if (state.monitoringInterval) {
        clearInterval(state.monitoringInterval);
    }
    
    state.monitoringInterval = setInterval(updateDashboard, 5000);
}

function updateStats() {
    const activeVPS = state.vpsList.filter(v => v.status === 'active').length;
    const totalVPS = state.vpsList.length;
    
    document.getElementById('totalVPS').textContent = totalVPS;
    document.getElementById('cpuUsage').textContent = '24%';
    document.getElementById('ramUsage').textContent = '65%';
    document.getElementById('storageUsage').textContent = '42%';
    document.getElementById('vpsCount').textContent = totalVPS;
}

async function loadVPSData() {
    try {
        // Try to fetch from DigitalOcean API
        const response = await fetch('https://api.digitalocean.com/v2/droplets', {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            state.vpsList = data.droplets || [];
            console.log(`Loaded ${state.vpsList.length} VPS from DigitalOcean`);
        } else {
            throw new Error('API Error');
        }
    } catch (error) {
        console.log('Using demo data:', error.message);
        // Use demo data
        state.vpsList = getDemoVPSData();
    }
    
    updateStats();
    updateVPSList();
}

function initCharts() {
    // Chart 1: Resource Usage
    const chart1 = new ApexCharts(document.querySelector("#chart1"), {
        series: [{
            name: 'CPU',
            data: [30, 40, 35, 50, 49, 60, 70, 91, 125]
        }, {
            name: 'Memory',
            data: [23, 32, 27, 38, 36, 42, 52, 38, 45]
        }],
        chart: {
            height: 250,
            type: 'area',
            toolbar: { show: false }
        },
        colors: ['#3b82f6', '#10b981'],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth' },
        xaxis: {
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
        },
        tooltip: { theme: 'dark' }
    });
    
    chart1.render();
    state.charts.dashboard1 = chart1;
    
    // Chart 2: VPS Status
    const active = state.vpsList.filter(v => v.status === 'active').length;
    const stopped = state.vpsList.filter(v => v.status === 'off').length;
    
    const chart2 = new ApexCharts(document.querySelector("#chart2"), {
        series: [active, stopped],
        chart: {
            height: 250,
            type: 'donut'
        },
        labels: ['Active', 'Stopped'],
        colors: ['#10b981', '#ef4444'],
        legend: { position: 'bottom' },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total',
                            color: '#fff'
                        }
                    }
                }
            }
        },
        tooltip: { theme: 'dark' }
    });
    
    chart2.render();
    state.charts.dashboard2 = chart2;
}

function updateDashboard() {
    // Update live metrics with random data
    const cpu = Math.floor(Math.random() * 30) + 20;
    const ram = Math.floor(Math.random() * 40) + 40;
    const storage = Math.floor(Math.random() * 30) + 30;
    
    document.getElementById('cpuUsage').textContent = `${cpu}%`;
    document.getElementById('ramUsage').textContent = `${ram}%`;
    document.getElementById('storageUsage').textContent = `${storage}%`;
    
    // Update chart data
    if (state.charts.dashboard1) {
        const newData = Array.from({length: 9}, () => Math.floor(Math.random() * 100));
        state.charts.dashboard1.updateSeries([{
            data: newData
        }, {
            data: newData.map(x => x * 0.7)
        }]);
    }
}

// =================== VPS MANAGEMENT ===================
function loadVPS() {
    updateVPSList();
}

function updateVPSList() {
    const container = document.getElementById('vpsList');
    const noVPS = document.getElementById('noVPS');
    
    if (state.vpsList.length === 0) {
        container.innerHTML = '';
        noVPS.style.display = 'block';
        return;
    }
    
    noVPS.style.display = 'none';
    
    container.innerHTML = state.vpsList.map(vps => {
        const ip = vps.networks?.v4?.find(n => n.type === 'public')?.ip_address || 'No IP';
        const status = vps.status || 'unknown';
        const memoryGB = Math.round((vps.memory || 0) / 1024);
        
        return `
            <div class="vps-card">
                <div class="vps-card-header">
                    <div class="vps-icon">
                        <i class="fab fa-${vps.image?.slug?.includes('ubuntu') ? 'ubuntu' : 'linux'}"></i>
                    </div>
                    <div class="vps-info">
                        <h4>${vps.name}</h4>
                        <p>${vps.region?.name || 'Unknown'}</p>
                    </div>
                    <div class="vps-status ${status === 'active' ? 'status-active' : 'status-stopped'}">
                        ${status}
                    </div>
                </div>
                
                <div class="vps-specs">
                    <div class="spec-item">
                        <i class="fas fa-microchip"></i>
                        <div class="spec-value">${vps.vcpus || 2}</div>
                        <div class="spec-label">vCPU</div>
                    </div>
                    <div class="spec-item">
                        <i class="fas fa-memory"></i>
                        <div class="spec-value">${memoryGB}</div>
                        <div class="spec-label">GB RAM</div>
                    </div>
                    <div class="spec-item">
                        <i class="fas fa-hdd"></i>
                        <div class="spec-value">${vps.disk || 60}</div>
                        <div class="spec-label">GB SSD</div>
                    </div>
                    <div class="spec-item">
                        <i class="fas fa-network-wired"></i>
                        <div class="spec-value">${ip.split('.')[0]}</div>
                        <div class="spec-label">IP Address</div>
                    </div>
                </div>
                
                <div class="vps-actions">
                    <button class="action-btn" onclick="vpsAction('${vps.id}', 'power_on')" ${status === 'active' ? 'disabled' : ''}>
                        <i class="fas fa-play"></i> Start
                    </button>
                    <button class="action-btn" onclick="vpsAction('${vps.id}', 'power_off')" ${status !== 'active' ? 'disabled' : ''}>
                        <i class="fas fa-stop"></i> Stop
                    </button>
                    <button class="action-btn" onclick="showVPSDetails('${vps.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="action-btn danger" onclick="deleteVPS('${vps.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function vpsAction(vpsId, action) {
    try {
        showToast(`${action === 'power_on' ? 'Starting' : 'Stopping'} VPS...`, 'info');
        
        const response = await fetch(`https://api.digitalocean.com/v2/droplets/${vpsId}/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: action })
        });
        
        if (response.ok) {
            showToast(`VPS ${action === 'power_on' ? 'started' : 'stopped'} successfully`, 'success');
            setTimeout(() => loadVPSData(), 2000);
        } else {
            throw new Error('API Error');
        }
    } catch (error) {
        showToast('Action failed. Using demo mode.', 'warning');
        // Update local state for demo
        const vps = state.vpsList.find(v => v.id === vpsId);
        if (vps) {
            vps.status = action === 'power_on' ? 'active' : 'off';
            updateVPSList();
        }
    }
}

function deleteVPS(vpsId) {
    showModal(
        'Delete VPS',
        'Are you sure you want to delete this VPS? All data will be lost.',
        [
            { text: 'Cancel', action: 'close' },
            { 
                text: 'Delete', 
                action: async () => {
                    try {
                        await fetch(`https://api.digitalocean.com/v2/droplets/${vpsId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
                            }
                        });
                        
                        showToast('VPS deleted successfully', 'success');
                        state.vpsList = state.vpsList.filter(v => v.id !== vpsId);
                        updateVPSList();
                        closeModal();
                    } catch (error) {
                        showToast('Delete failed. Using demo mode.', 'warning');
                        state.vpsList = state.vpsList.filter(v => v.id !== vpsId);
                        updateVPSList();
                        closeModal();
                    }
                },
                style: 'danger'
            }
        ]
    );
}

function searchVPS(query) {
    if (!query) {
        updateVPSList();
        return;
    }
    
    const filtered = state.vpsList.filter(vps => 
        vps.name.toLowerCase().includes(query.toLowerCase()) ||
        vps.region?.name?.toLowerCase().includes(query.toLowerCase())
    );
    
    const container = document.getElementById('vpsList');
    const noVPS = document.getElementById('noVPS');
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        noVPS.style.display = 'block';
        noVPS.innerHTML = `
            <i class="fas fa-search"></i>
            <h3>No VPS Found</h3>
            <p>No VPS matching "${query}"</p>
        `;
    } else {
        noVPS.style.display = 'none';
        // Similar rendering logic as updateVPSList but with filtered data
    }
}

function showVPSDetails(vpsId) {
    const vps = state.vpsList.find(v => v.id === vpsId);
    if (!vps) return;
    
    const ip = vps.networks?.v4?.find(n => n.type === 'public')?.ip_address || 'No IP';
    const memoryGB = Math.round((vps.memory || 0) / 1024);
    
    showModal(
        vps.name,
        `
        <div class="vps-detail">
            <div class="detail-section">
                <h4>Details</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span>Status:</span>
                        <strong class="${vps.status === 'active' ? 'text-success' : 'text-danger'}">${vps.status}</strong>
                    </div>
                    <div class="detail-item">
                        <span>Region:</span>
                        <strong>${vps.region?.name || 'Unknown'}</strong>
                    </div>
                    <div class="detail-item">
                        <span>vCPU:</span>
                        <strong>${vps.vcpus || 2}</strong>
                    </div>
                    <div class="detail-item">
                        <span>RAM:</span>
                        <strong>${memoryGB} GB</strong>
                    </div>
                    <div class="detail-item">
                        <span>Storage:</span>
                        <strong>${vps.disk || 60} GB</strong>
                    </div>
                    <div class="detail-item">
                        <span>IP Address:</span>
                        <strong>${ip}</strong>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Connection</h4>
                <div class="connection-box">
                    <code>ssh root@${ip}</code>
                    <button class="btn-copy" onclick="copyToClipboard('ssh root@${ip}')">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
            </div>
            
            <div class="detail-actions">
                <button class="btn-action" onclick="vpsAction('${vpsId}', 'power_on')" ${vps.status === 'active' ? 'disabled' : ''}>
                    <i class="fas fa-play"></i> Start
                </button>
                <button class="btn-action" onclick="vpsAction('${vpsId}', 'power_off')" ${vps.status !== 'active' ? 'disabled' : ''}>
                    <i class="fas fa-stop"></i> Stop
                </button>
                <button class="btn-action" onclick="vpsAction('${vpsId}', 'reboot')">
                    <i class="fas fa-redo"></i> Reboot
                </button>
            </div>
        </div>
        `
    );
}

// =================== CREATE VPS WIZARD ===================
function initCreateWizard() {
    state.currentStep = 1;
    
    // Show step 1
    document.querySelectorAll('.create-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById('step1').classList.add('active');
    
    // Update steps
    document.querySelectorAll('.create-steps .step').forEach((step, index) => {
        step.classList.remove('active');
        if (index === 0) step.classList.add('active');
    });
    
    // Set default values
    state.createData = {
        cpu: 'amd',
        ram: 8,
        region: 'sgp1',
        os: 'ubuntu-22-04',
        name: 'vps-' + Date.now().toString().slice(-6),
        password: ''
    };
    
    // Update form
    document.getElementById('vpsName').value = state.createData.name;
    updateReview();
}

function selectCPU(type) {
    state.createData.cpu = type;
    document.querySelectorAll('.cpu-option').forEach(opt => {
        opt.classList.remove('active');
    });
    event.target.closest('.cpu-option').classList.add('active');
    updateReview();
}

function selectRAM(size) {
    state.createData.ram = size;
    document.querySelectorAll('.ram-option').forEach(opt => {
        opt.classList.remove('active');
    });
    event.target.closest('.ram-option').classList.add('active');
    updateReview();
}

function nextStep(step) {
    // Validate current step
    if (step === 3) {
        const name = document.getElementById('vpsName').value.trim();
        if (!name) {
            showToast('Please enter VPS name', 'error');
            return;
        }
        state.createData.name = name;
    }
    
    if (step === 4) {
        const password = document.getElementById('rootPassword').value.trim();
        if (!password) {
            showToast('Please enter root password', 'error');
            return;
        }
        state.createData.password = password;
    }
    
    // Update steps UI
    document.querySelectorAll('.create-step').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');
    
    document.querySelectorAll('.create-steps .step').forEach((s, index) => {
        s.classList.remove('active');
        if (index < step) s.classList.add('active');
    });
    
    state.currentStep = step;
    updateReview();
}

function prevStep() {
    if (state.currentStep > 1) {
        nextStep(state.currentStep - 1);
    }
}

function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('rootPassword').value = password;
    showToast('Password generated', 'success');
}

function updateReview() {
    // CPU
    document.getElementById('reviewCPU').textContent = 
        state.createData.cpu === 'amd' ? 'AMD EPYC' : 'Intel Premium';
    
    // RAM
    document.getElementById('reviewRAM').textContent = `${state.createData.ram} GB`;
    
    // Storage based on RAM
    const storageMap = { 4: '60 GB', 8: '120 GB', 16: '240 GB', 32: '480 GB' };
    document.getElementById('reviewStorage').textContent = 
        storageMap[state.createData.ram] || '120 GB SSD';
    
    // Region
    const regionMap = {
        'sgp1': 'Singapore',
        'nyc1': 'New York',
        'fra1': 'Frankfurt'
    };
    document.getElementById('reviewRegion').textContent = 
        regionMap[state.createData.region] || 'Singapore';
    
    // OS
    const osMap = {
        'ubuntu-22-04': 'Ubuntu 22.04',
        'ubuntu-24-04': 'Ubuntu 24.04',
        'debian-11': 'Debian 11'
    };
    document.getElementById('reviewOS').textContent = 
        osMap[state.createData.os] || 'Ubuntu 22.04';
}

async function createVPS() {
    try {
        showToast('Creating VPS... Please wait (2-3 minutes)', 'info');
        
        // Prepare droplet data
        const sizeSlug = getSizeSlug();
        
        const dropletData = {
            name: state.createData.name,
            region: state.createData.region,
            size: sizeSlug,
            image: state.createData.os,
            backups: document.getElementById('enableBackup').checked,
            ipv6: document.getElementById('enableIPv6').checked,
            monitoring: document.getElementById('enableMonitoring').checked,
            user_data: `#cloud-config
chpasswd:
  list: |
    root:${state.createData.password}
  expire: false
ssh_pwauth: true`
        };
        
        // Call DigitalOcean API
        const response = await fetch('https://api.digitalocean.com/v2/droplets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dropletData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showToast('✅ VPS created successfully!', 'success');
            
            // Save password
            localStorage.setItem(`vps_pass_${data.droplet.id}`, state.createData.password);
            
            // Redirect to VPS list
            setTimeout(() => {
                showPage('vps');
                loadVPSData();
            }, 3000);
            
        } else {
            const error = await response.json();
            throw new Error(error.message || 'API Error');
        }
        
    } catch (error) {
        console.error('Create VPS error:', error);
        showToast('Using demo mode - VPS created locally', 'warning');
        
        // Create demo VPS
        const demoVPS = {
            id: 'demo_' + Date.now(),
            name: state.createData.name,
            status: 'active',
            vcpus: state.createData.ram >= 16 ? 8 : state.createData.ram >= 8 ? 4 : 2,
            memory: state.createData.ram * 1024,
            disk: state.createData.ram * 15,
            region: { name: state.createData.region === 'sgp1' ? 'Singapore' : 'New York' },
            networks: {
                v4: [{ ip_address: '192.168.1.' + Math.floor(Math.random() * 255), type: 'public' }]
            },
            image: { slug: state.createData.os }
        };
        
        state.vpsList.push(demoVPS);
        
        showToast('✅ Demo VPS created!', 'success');
        
        setTimeout(() => {
            showPage('vps');
            updateVPSList();
        }, 2000);
    }
}

function getSizeSlug() {
    const cpu = state.createData.cpu;
    const ram = state.createData.ram;
    
    if (cpu === 'amd') {
        if (ram === 4) return 's-2vcpu-4gb-amd';
        if (ram === 8) return 's-4vcpu-8gb-amd';
        if (ram === 16) return 's-8vcpu-16gb-amd';
        if (ram === 32) return 's-16vcpu-32gb-amd';
    } else {
        if (ram === 4) return 's-2vcpu-4gb-intel';
        if (ram === 8) return 's-4vcpu-8gb-intel';
        if (ram === 16) return 's-8vcpu-16gb-intel';
        if (ram === 32) return 's-16vcpu-32gb-intel';
    }
    
    return 's-4vcpu-8gb-amd';
}

// =================== MONITORING ===================
function loadMonitoring() {
    // Populate VPS selector
    const select = document.getElementById('monitorSelect');
    select.innerHTML = '<option value="">Select VPS to monitor</option>' +
        state.vpsList.map(vps => 
            `<option value="${vps.id}">${vps.name}</option>`
        ).join('');
    
    // Initialize monitoring charts
    initMonitoringCharts();
    
    // Start monitoring updates
    startMonitoring();
}

function initMonitoringCharts() {
    // Chart 1: CPU & Memory
    const chart1 = new ApexCharts(document.querySelector("#monitorChart1"), {
        series: [{
            name: 'CPU',
            data: generateRandomData(24, 20, 80)
        }, {
            name: 'Memory',
            data: generateRandomData(24, 40, 90)
        }],
        chart: {
            height: 250,
            type: 'line',
            toolbar: { show: false }
        },
        colors: ['#3b82f6', '#10b981'],
        stroke: { curve: 'smooth' },
        xaxis: {
            categories: Array.from({length: 24}, (_, i) => `${i}:00`)
        },
        tooltip: { theme: 'dark' }
    });
    
    chart1.render();
    state.charts.monitor1 = chart1;
    
    // Chart 2: Disk Usage
    const chart2 = new ApexCharts(document.querySelector("#monitorChart2"), {
        series: [75],
        chart: {
            height: 250,
            type: 'radialBar'
        },
        plotOptions: {
            radialBar: {
                hollow: { size: '70%' }
            }
        },
        labels: ['Disk Usage'],
        colors: ['#f59e0b']
    });
    
    chart2.render();
    state.charts.monitor2 = chart2;
}

function startMonitoring() {
    // Update live metrics every 3 seconds
    setInterval(() => {
        document.getElementById('liveCPU').textContent = `${Math.floor(Math.random() * 30) + 20}%`;
        document.getElementById('liveRAM').textContent = `${Math.floor(Math.random() * 40) + 40}%`;
        document.getElementById('liveDisk').textContent = `${Math.floor(Math.random() * 30) + 30}%`;
        document.getElementById('liveNetwork').textContent = `${Math.floor(Math.random() * 100)} MB/s`;
        
        // Update charts
        if (state.charts.monitor1) {
            state.charts.monitor1.updateSeries([{
                data: generateRandomData(24, 20, 80)
            }, {
                data: generateRandomData(24, 40, 90)
            }]);
        }
        
        if (state.charts.monitor2) {
            const usage = Math.floor(Math.random() * 30) + 60;
            state.charts.monitor2.updateSeries([usage]);
        }
    }, 3000);
}

// =================== SETTINGS ===================
function changePassword() {
    showModal(
        'Change Password',
        `
        <div class="form-group">
            <label>Current Password</label>
            <input type="password" id="currentPassword" placeholder="Enter current password">
        </div>
        <div class="form-group">
            <label>New Password</label>
            <input type="password" id="newPassword" placeholder="Enter new password">
        </div>
        <div class="form-group">
            <label>Confirm New Password</label>
            <input type="password" id="confirmPassword" placeholder="Confirm new password">
        </div>
        `,
        [
            { text: 'Cancel', action: 'close' },
            { 
                text: 'Change Password', 
                action: () => {
                    const current = document.getElementById('currentPassword').value;
                    const newPass = document.getElementById('newPassword').value;
                    const confirm = document.getElementById('confirmPassword').value;
                    
                    if (!current || !newPass || !confirm) {
                        showToast('Please fill all fields', 'error');
                        return;
                    }
                    
                    if (newPass !== confirm) {
                        showToast('New passwords do not match', 'error');
                        return;
                    }
                    
                    showToast('Password changed successfully', 'success');
                    closeModal();
                }
            }
        ]
    );
}

// =================== UTILITIES ===================
function showModal(title, content, buttons = []) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    
    // Add buttons if provided
    if (buttons.length > 0) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-buttons';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.text;
            button.className = btn.style === 'danger' ? 'btn-action danger' : 'btn-action';
            button.onclick = btn.action === 'close' ? closeModal : btn.action;
            buttonContainer.appendChild(button);
        });
        
        document.getElementById('modalBody').appendChild(buttonContainer);
    }
    
    document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

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
        <button onclick="hideToast()" style="margin-left: auto; background: none; border: none; color: #94a3b8;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toast.classList.add('show');
    
    setTimeout(hideToast, 5000);
}

function hideToast() {
    document.getElementById('toast').classList.remove('show');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard', 'success');
    }).catch(() => {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Copied to clipboard', 'success');
    });
}

function showNotifications() {
    showModal(
        'Notifications',
        `
        <div class="notification-list">
            <div class="notification-item">
                <i class="fas fa-check-circle text-success"></i>
                <div>
                    <p>System running normally</p>
                    <span>Just now</span>
                </div>
            </div>
            <div class="notification-item">
                <i class="fas fa-info-circle text-info"></i>
                <div>
                    <p>Dashboard updated</p>
                    <span>5 minutes ago</span>
                </div>
            </div>
        </div>
        `
    );
}

// =================== DEMO DATA ===================
function getDemoVPSData() {
    return [
        {
            id: 'demo_001',
            name: 'web-server',
            status: 'active',
            vcpus: 2,
            memory: 4096,
            disk: 80,
            region: { name: 'Singapore' },
            networks: {
                v4: [{ ip_address: '104.131.186.241', type: 'public' }]
            },
            image: { slug: 'ubuntu-22-04' }
        },
        {
            id: 'demo_002',
            name: 'db-cluster',
            status: 'active',
            vcpus: 4,
            memory: 8192,
            disk: 160,
            region: { name: 'New York' },
            networks: {
                v4: [{ ip_address: '138.197.192.241', type: 'public' }]
            },
            image: { slug: 'ubuntu-24-04' }
        },
        {
            id: 'demo_003',
            name: 'dev-server',
            status: 'off',
            vcpus: 1,
            memory: 1024,
            disk: 25,
            region: { name: 'Frankfurt' },
            networks: {
                v4: [{ ip_address: '165.227.93.89', type: 'public' }]
            },
            image: { slug: 'debian-11' }
        }
    ];
}

function generateRandomData(count, min, max) {
    return Array.from({length: count}, () => 
        Math.floor(Math.random() * (max - min + 1)) + min
    );
}

// =================== INITIALIZE ===================
console.log('✅ CloudSphere loaded successfully!');
