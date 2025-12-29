// =================== CONFIGURATION ===================
const CONFIG = {
    BOT_TOKEN: "8593943514:AAFP-TnIvMJ5NJFYo2oUAFxZX_-OFPt35xM",
    DO_TOKEN: "dop_v1_7247527f3af1236d1faa1dd513124a513e88d325a75fbddc0f965c6daaa9d0f3",
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
    
    // Hide loading after 2 seconds
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
        checkAuth();
    }, 2000);
    
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
        showToast('Telegram ID not authorized. Contact @CloudSphereBot', 'error');
        return;
    }
    
    // In production, verify with backend
    // For now, create user object
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

function createViaTelegram() {
    const botUrl = `https://t.me/${CONFIG.BOT_USERNAME}`;
    
    showModal(
        'Create Account via Telegram',
        `
        <div style="text-align: left;">
            <p>To create an account:</p>
            <ol>
                <li>Open <a href="${botUrl}" target="_blank">@${CONFIG.BOT_USERNAME}</a></li>
                <li>Send <code>/start</code> command</li>
                <li>Send <code>/register</code> to register</li>
                <li>You'll receive your Telegram ID and password</li>
                <li>Return here and login</li>
            </ol>
            <p style="margin-top: 20px; color: #94a3b8;">
                <i class="fas fa-info-circle"></i> Account creation requires Telegram verification
            </p>
        </div>
        `,
        [
            { text: 'Cancel', action: 'close' },
            { text: 'Open Telegram', action: () => window.open(botUrl, '_blank') }
        ]
    );
}

function togglePassword() {
    const input = document.getElementById('password');
    const icon = document.querySelector('.toggle-password i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
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
                    localStorage.removeItem('vps_token');
                    localStorage.removeItem('vps_user');
                    state.user = null;
                    showLogin();
                    addActivity('User logged out', 'info');
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
    
    // Update active nav
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

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

// =================== DASHBOARD ===================
async function loadDashboard() {
    try {
        showToast('Loading dashboard...', 'info');
        
        // Load VPS data
        await loadVPSData();
        
        // Update stats
        updateDashboardStats();
        
        // Initialize charts
        initDashboardCharts();
        
        // Load activity
        loadActivity();
        
        // Start auto-refresh
        startDashboardRefresh();
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showToast('Failed to load dashboard', 'error');
    }
}

async function loadVPSData() {
    try {
        console.log('📡 Fetching VPS from DigitalOcean...');
        
        const response = await fetch(`${CONFIG.DO_API}/droplets`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        state.vpsList = data.droplets || [];
        
        console.log(`✅ Loaded ${state.vpsList.length} VPS`);
        addActivity(`Loaded ${state.vpsList.length} VPS`, 'info');
        
    } catch (error) {
        console.error('Failed to load VPS:', error);
        showToast('Failed to load VPS from DigitalOcean', 'error');
        throw error;
    }
}

function updateDashboardStats() {
    const activeVPS = state.vpsList.filter(v => v.status === 'active').length;
    const totalVPS = state.vpsList.length;
    
    // Calculate average usage (in real app, would fetch metrics)
    const avgCPU = Math.floor(Math.random() * 30) + 20;
    const avgRAM = Math.floor(Math.random() * 40) + 40;
    const avgStorage = Math.floor(Math.random() * 30) + 30;
    
    document.getElementById('totalVPS').textContent = totalVPS;
    document.getElementById('cpuUsage').textContent = `${avgCPU}%`;
    document.getElementById('ramUsage').textContent = `${avgRAM}%`;
    document.getElementById('storageUsage').textContent = `${avgStorage}%`;
    document.getElementById('vpsCount').textContent = totalVPS;
}

function initDashboardCharts() {
    // Resource Usage Chart
    const chart1 = new ApexCharts(document.querySelector("#chart1"), {
        series: [{
            name: 'CPU Usage',
            data: generateTimeSeriesData(24, 20, 80)
        }, {
            name: 'Memory Usage',
            data: generateTimeSeriesData(24, 40, 90)
        }, {
            name: 'Disk I/O',
            data: generateTimeSeriesData(24, 10, 60)
        }],
        chart: {
            height: 250,
            type: 'area',
            toolbar: { show: false }
        },
        colors: ['#3b82f6', '#10b981', '#f59e0b'],
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 90, 100]
            }
        },
        xaxis: {
            categories: generateTimeLabels(24, 'hour'),
            labels: { style: { colors: '#94a3b8' } }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8' } }
        },
        tooltip: { theme: 'dark' }
    });
    
    chart1.render();
    state.charts.dashboard = chart1;
    
    // VPS Distribution Chart
    const regions = {};
    state.vpsList.forEach(vps => {
        const region = vps.region?.slug || 'unknown';
        regions[region] = (regions[region] || 0) + 1;
    });
    
    const chart2 = new ApexCharts(document.querySelector("#chart2"), {
        series: Object.values(regions),
        chart: {
            height: 250,
            type: 'donut'
        },
        labels: Object.keys(regions).map(r => r.toUpperCase()),
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        legend: {
            position: 'bottom',
            labels: { colors: '#94a3b8' }
        },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total VPS',
                            color: '#fff'
                        }
                    }
                }
            }
        },
        tooltip: { theme: 'dark' }
    });
    
    chart2.render();
    state.charts.distribution = chart2;
}

function loadActivity() {
    const container = document.getElementById('activityList');
    
    if (state.activityLog.length === 0) {
        state.activityLog = [
            { message: 'System initialized', time: 'Just now', type: 'info' },
            { message: 'Ready to manage VPS', time: 'Just now', type: 'success' }
        ];
    }
    
    container.innerHTML = state.activityLog.map(item => `
        <div class="activity-item">
            <i class="fas fa-${getActivityIcon(item.type)} text-${item.type}"></i>
            <div>
                <p>${item.message}</p>
                <span>${item.time}</span>
            </div>
        </div>
    `).join('');
}

function addActivity(message, type = 'info') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.activityLog.unshift({ message, time, type });
    
    // Keep only last 10 activities
    if (state.activityLog.length > 10) {
        state.activityLog.pop();
    }
    
    loadActivity();
}

function startDashboardRefresh() {
    // Clear existing interval
    if (state.monitoringInterval) {
        clearInterval(state.monitoringInterval);
    }
    
    // Refresh every 30 seconds
    state.monitoringInterval = setInterval(async () => {
        try {
            await loadVPSData();
            updateDashboardStats();
            
            // Update charts with new data
            if (state.charts.dashboard) {
                state.charts.dashboard.updateSeries([{
                    data: generateTimeSeriesData(24, 20, 80)
                }, {
                    data: generateTimeSeriesData(24, 40, 90)
                }, {
                    data: generateTimeSeriesData(24, 10, 60)
                }]);
            }
            
        } catch (error) {
            console.error('Refresh error:', error);
        }
    }, 30000);
}

// =================== VPS MANAGEMENT ===================
async function loadVPS() {
    try {
        showToast('Loading VPS...', 'info');
        await loadVPSData();
        renderVPSList();
    } catch (error) {
        console.error('Load VPS error:', error);
        showToast('Failed to load VPS', 'error');
    }
}

function renderVPSList() {
    const container = document.getElementById('vpsList');
    const noVPS = document.getElementById('noVPS');
    
    if (state.vpsList.length === 0) {
        container.innerHTML = '';
        noVPS.classList.remove('hidden');
        return;
    }
    
    noVPS.classList.add('hidden');
    
    container.innerHTML = state.vpsList.map(vps => {
        const ip = vps.networks?.v4?.find(n => n.type === 'public')?.ip_address || 'No IP';
        const status = vps.status || 'unknown';
        const memoryGB = Math.round((vps.memory || 0) / 1024);
        
        return `
            <div class="vps-card">
                <div class="vps-card-header">
                    <div class="vps-icon">
                        <i class="fab fa-${getOSIcon(vps.image?.slug)}"></i>
                    </div>
                    <div class="vps-info">
                        <h4>${vps.name}</h4>
                        <p>${vps.region?.name || 'Unknown Region'}</p>
                    </div>
                    <div class="vps-status ${getStatusClass(status)}">
                        ${status.toUpperCase()}
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
                    <button class="action-btn" onclick="vpsAction('${vps.id}', 'reboot')">
                        <i class="fas fa-redo"></i> Reboot
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
        showToast(`${getActionText(action)} VPS...`, 'info');
        
        const response = await fetch(`${CONFIG.DO_API}/droplets/${vpsId}/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: action })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        showToast(`VPS ${getActionText(action)} successfully`, 'success');
        addActivity(`VPS action: ${action} executed`, 'info');
        
        // Refresh VPS list after 2 seconds
        setTimeout(() => loadVPSData().then(renderVPSList), 2000);
        
    } catch (error) {
        console.error('VPS action error:', error);
        showToast(`Failed to ${getActionText(action)} VPS`, 'error');
    }
}

function getActionText(action) {
    const actions = {
        'power_on': 'start',
        'power_off': 'stop',
        'reboot': 'reboot',
        'shutdown': 'shutdown'
    };
    return actions[action] || action;
}

async function deleteVPS(vpsId) {
    showModal(
        'Delete VPS',
        'This action cannot be undone. All data will be permanently deleted.',
        [
            { text: 'Cancel', action: 'close' },
            { 
                text: 'Delete VPS', 
                action: async () => {
                    try {
                        showToast('Deleting VPS...', 'info');
                        
                        const response = await fetch(`${CONFIG.DO_API}/droplets/${vpsId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`API Error: ${response.status}`);
                        }
                        
                        showToast('VPS deleted successfully', 'success');
                        addActivity('VPS deleted', 'warning');
                        
                        // Remove from local state
                        state.vpsList = state.vpsList.filter(v => v.id !== vpsId);
                        delete state.vpsPasswords[vpsId];
                        
                        // Update UI
                        renderVPSList();
                        closeModal();
                        
                    } catch (error) {
                        console.error('Delete error:', error);
                        showToast('Failed to delete VPS', 'error');
                    }
                },
                style: 'danger'
            }
        ]
    );
}

function filterVPS(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // In a real implementation, filter the VPS list
    showToast(`Filtering by: ${filter}`, 'info');
}

function searchVPS(query) {
    if (!query) {
        renderVPSList();
        return;
    }
    
    const filtered = state.vpsList.filter(vps => 
        vps.name.toLowerCase().includes(query.toLowerCase()) ||
        vps.region?.name?.toLowerCase().includes(query.toLowerCase()) ||
        vps.networks?.v4?.some(ip => ip.ip_address.includes(query))
    );
    
    const container = document.getElementById('vpsList');
    const noVPS = document.getElementById('noVPS');
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        noVPS.classList.remove('hidden');
        noVPS.innerHTML = `
            <i class="fas fa-search"></i>
            <h3>No VPS Found</h3>
            <p>No VPS matching "${query}"</p>
        `;
    } else {
        noVPS.classList.add('hidden');
        // Render filtered list
    }
}

function showVPSDetails(vpsId) {
    const vps = state.vpsList.find(v => v.id === vpsId);
    if (!vps) return;
    
    const ip = vps.networks?.v4?.find(n => n.type === 'public')?.ip_address || 'No IP';
    const privateIp = vps.networks?.v4?.find(n => n.type === 'private')?.ip_address || 'No IP';
    const memoryGB = Math.round((vps.memory || 0) / 1024);
    const password = state.vpsPasswords[vpsId] || 'Not saved';
    
    showModal(
        vps.name,
        `
        <div class="vps-detail">
            <div class="detail-header">
                <div class="detail-icon">
                    <i class="fab fa-${getOSIcon(vps.image?.slug)}"></i>
                </div>
                <div>
                    <h3>${vps.name}</h3>
                    <p>${vps.region?.name || 'Unknown Region'}</p>
                </div>
                <div class="detail-status ${getStatusClass(vps.status)}">
                    ${vps.status.toUpperCase()}
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> Details</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span>Status:</span>
                        <strong class="${vps.status === 'active' ? 'text-success' : 'text-danger'}">${vps.status}</strong>
                    </div>
                    <div class="detail-item">
                        <span>Created:</span>
                        <strong>${new Date(vps.created_at).toLocaleDateString()}</strong>
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
                        <span>Public IP:</span>
                        <strong>${ip}</strong>
                    </div>
                    <div class="detail-item">
                        <span>Private IP:</span>
                        <strong>${privateIp}</strong>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-terminal"></i> Connection</h4>
                <div class="connection-box">
                    <div class="connection-item">
                        <code>ssh root@${ip}</code>
                        <button class="btn-copy" onclick="copyToClipboard('ssh root@${ip}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <div class="connection-item">
                        <span>Password: </span>
                        <span class="password">●●●●●●●●</span>
                        <button class="btn-show" onclick="showPassword('${vpsId}')">
                            <i class="fas fa-eye"></i> Show
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="detail-actions">
                <button class="btn-action success" onclick="vpsAction('${vpsId}', 'power_on')" ${vps.status === 'active' ? 'disabled' : ''}>
                    <i class="fas fa-play"></i> Start
                </button>
                <button class="btn-action danger" onclick="vpsAction('${vpsId}', 'power_off')" ${vps.status !== 'active' ? 'disabled' : ''}>
                    <i class="fas fa-stop"></i> Stop
                </button>
                <button class="btn-action warning" onclick="vpsAction('${vpsId}', 'reboot')">
                    <i class="fas fa-redo"></i> Reboot
                </button>
                <button class="btn-action" onclick="showPage('monitoring'); selectVPSMonitor('${vpsId}')">
                    <i class="fas fa-chart-line"></i> Monitor
                </button>
            </div>
        </div>
        `
    );
}

function showPassword(vpsId) {
    const password = state.vpsPasswords[vpsId];
    
    if (!password) {
        showToast('Password not saved for this VPS', 'warning');
        return;
    }
    
    showModal(
        'Root Password',
        `
        <div style="font-family: monospace; font-size: 1.2rem; padding: 20px; background: #1e293b; border-radius: 10px; margin: 20px 0; text-align: center;">
            ${password}
        </div>
        <p style="color: #94a3b8; text-align: center;">
            Save this password securely. It won't be shown again.
        </p>
        `,
        [
            { text: 'Close', action: 'close' },
            { 
                text: 'Copy Password', 
                action: () => {
                    copyToClipboard(password);
                    showToast('Password copied to clipboard', 'success');
                    closeModal();
                }
            }
        ]
    );
}

// =================== CREATE VPS WIZARD ===================
function initCreateWizard() {
    state.currentStep = 1;
    state.createState = {
        cpu: 'amd',
        ram: '8',
        region: 'sgp1',
        os: 'ubuntu-22-04-x64',
        name: `vps-${Date.now().toString().slice(-6)}`,
        password: ''
    };
    
    // Reset UI
    document.querySelectorAll('.create-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById('step1').classList.add('active');
    
    document.querySelectorAll('.create-steps .step').forEach((step, index) => {
        step.classList.remove('active');
        if (index === 0) step.classList.add('active');
    });
    
    // Reset selections
    document.querySelectorAll('.cpu-option, .ram-option').forEach(opt => {
        opt.classList.remove('active');
    });
    document.querySelector('.cpu-option[onclick*="amd"]').classList.add('active');
    document.querySelector('.ram-option[onclick*="8"]').classList.add('active');
    
    // Reset form
    document.getElementById('vpsName').value = state.createState.name;
    document.getElementById('vpsRegion').value = state.createState.region;
    document.getElementById('vpsOS').value = state.createState.os;
    document.getElementById('rootPassword').value = '';
    document.getElementById('enableBackup').checked = true;
    document.getElementById('enableIPv6').checked = true;
    document.getElementById('enableMonitoring').checked = true;
    document.getElementById('enableFirewall').checked = false;
    
    updateReview();
}

function selectCPU(type) {
    state.createState.cpu = type;
    document.querySelectorAll('.cpu-option').forEach(opt => {
        opt.classList.remove('active');
    });
    event.target.closest('.cpu-option').classList.add('active');
    updateReview();
}

function selectRAM(size) {
    state.createState.ram = size;
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
        state.createState.name = name;
    }
    
    if (step === 4) {
        const password = document.getElementById('rootPassword').value.trim();
        if (!password) {
            showToast('Please enter root password', 'error');
            return;
        }
        state.createState.password = password;
    }
    
    // Update UI
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
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('rootPassword').value = password;
    state.createState.password = password;
    showToast('Secure password generated', 'success');
}

function updateReview() {
    // CPU Type
    document.getElementById('reviewCPU').textContent = 
        state.createState.cpu === 'amd' ? 'AMD EPYC' : 'Intel Premium';
    
    // RAM Size
    document.getElementById('reviewRAM').textContent = `${state.createState.ram} GB`;
    
    // Storage based on RAM
    const storageMap = { '4': '60 GB SSD', '8': '120 GB SSD', '16': '240 GB SSD', '32': '480 GB SSD' };
    document.getElementById('reviewStorage').textContent = storageMap[state.createState.ram] || '120 GB SSD';
    
    // Region
    const regionMap = {
        'sgp1': 'Singapore (SGP1)',
        'nyc1': 'New York (NYC1)',
        'fra1': 'Frankfurt (FRA1)',
        'blr1': 'Bangalore (BLR1)',
        'sfo1': 'San Francisco (SFO1)'
    };
    document.getElementById('reviewRegion').textContent = regionMap[state.createState.region] || 'Singapore (SGP1)';
    
    // OS
    const osMap = {
        'ubuntu-22-04-x64': 'Ubuntu 22.04 LTS',
        'ubuntu-24-04-x64': 'Ubuntu 24.04 LTS',
        'debian-11-x64': 'Debian 11',
        'centos-7-x64': 'CentOS 7'
    };
    document.getElementById('reviewOS').textContent = osMap[state.createState.os] || 'Ubuntu 22.04 LTS';
    
    // Backup & IPv6
    const enableBackup = document.getElementById('enableBackup').checked;
    const enableIPv6 = document.getElementById('enableIPv6').checked;
    
    document.getElementById('reviewBackup').textContent = enableBackup ? 'Enabled' : 'Disabled';
    document.getElementById('reviewIPv6').textContent = enableIPv6 ? 'Enabled' : 'Disabled';
    
    // Calculate price
    calculatePrice();
}

function calculatePrice() {
    const ram = parseInt(state.createState.ram);
    const cpu = state.createState.cpu;
    const enableBackup = document.getElementById('enableBackup').checked;
    
    // Base prices
    const basePrices = { '4': 20, '8': 40, '16': 80, '32': 160 };
    let basePrice = basePrices[ram] || 40;
    
    // AMD discount (10% cheaper)
    if (cpu === 'amd') {
        basePrice = basePrice * 0.9;
    }
    
    // Backup cost (+20%)
    const backupPrice = enableBackup ? basePrice * 0.2 : 0;
    const totalPrice = basePrice + backupPrice;
    
    // Update prices
    document.getElementById('basePrice').textContent = `$${basePrice.toFixed(2)}`;
    document.getElementById('backupPrice').textContent = `$${backupPrice.toFixed(2)}`;
    document.getElementById('totalPrice').textContent = `$${totalPrice.toFixed(2)}`;
    document.getElementById('reviewPrice').textContent = `$${totalPrice.toFixed(2)}`;
}

async function createVPS() {
    try {
        showToast('🚀 Creating VPS... This may take 2-3 minutes', 'info');
        
        // Get form values
        const name = state.createState.name;
        const region = state.createState.region;
        const size = getSizeSlug();
        const image = state.createState.os;
        const password = state.createState.password;
        const enableBackup = document.getElementById('enableBackup').checked;
        const enableIPv6 = document.getElementById('enableIPv6').checked;
        const enableMonitoring = document.getElementById('enableMonitoring').checked;
        const enableFirewall = document.getElementById('enableFirewall').checked;
        
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
        
        console.log('Creating droplet:', dropletData);
        
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
        
        // Send Telegram notification if bot token is configured
        if (CONFIG.BOT_TOKEN && state.user?.telegram_id) {
            try {
                await fetch(`${CONFIG.BOT_API}${CONFIG.BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: state.user.telegram_id,
                        text: `✅ VPS Created!\n\nName: ${name}\nRegion: ${region}\nSize: ${size}\nStatus: Creating...\n\nYou can manage it at the dashboard.`
                    })
                });
            } catch (telegramError) {
                console.error('Telegram notification failed:', telegramError);
            }
        }
        
        // Wait a moment and redirect to VPS list
        setTimeout(() => {
            showPage('vps');
            loadVPS();
        }, 3000);
        
    } catch (error) {
        console.error('Create VPS error:', error);
        showToast(`❌ Failed to create VPS: ${error.message}`, 'error');
        addActivity(`VPS creation failed: ${error.message}`, 'error');
    }
}

function getSizeSlug() {
    const cpu = state.createState.cpu;
    const ram = state.createState.ram;
    
    // AMD EPYC sizes
    if (cpu === 'amd') {
        switch(ram) {
            case '4': return 's-2vcpu-4gb-amd';
            case '8': return 's-4vcpu-8gb-amd';
            case '16': return 's-8vcpu-16gb-amd';
            case '32': return 's-16vcpu-32gb-amd';
            default: return 's-4vcpu-8gb-amd';
        }
    }
    
    // Intel Premium sizes
    if (cpu === 'intel') {
        switch(ram) {
            case '4': return 's-2vcpu-4gb-intel';
            case '8': return 's-4vcpu-8gb-intel';
            case '16': return 's-8vcpu-16gb-intel';
            case '32': return 's-16vcpu-32gb-intel';
            default: return 's-4vcpu-8gb-intel';
        }
    }
    
    return 's-4vcpu-8gb-amd';
}

// =================== MONITORING ===================
function loadMonitoring() {
    // Populate VPS selector
    const select = document.getElementById('monitorSelect');
    select.innerHTML = '<option value="">Select VPS to monitor</option>' +
        state.vpsList.map(vps => 
            `<option value="${vps.id}">${vps.name} (${vps.region?.slug || 'unknown'})</option>`
        ).join('');
    
    // Initialize charts
    initMonitoringCharts();
    
    // Start monitoring updates
    startMonitoringUpdates();
}

function selectVPSMonitor(vpsId) {
    if (!vpsId) return;
    
    state.selectedVPS = vpsId;
    const vps = state.vpsList.find(v => v.id === vpsId);
    
    if (vps) {
        showToast(`Monitoring ${vps.name}`, 'info');
        updateMonitoringData(vps);
    }
}

function initMonitoringCharts() {
    // CPU & Memory Chart
    const chart1 = new ApexCharts(document.querySelector("#monitorChart1"), {
        series: [{
            name: 'CPU Usage',
            data: generateTimeSeriesData(12, 20, 80)
        }, {
            name: 'Memory Usage',
            data: generateTimeSeriesData(12, 40, 90)
        }],
        chart: {
            height: 300,
            type: 'line',
            toolbar: { show: false }
        },
        colors: ['#3b82f6', '#10b981'],
        stroke: { curve: 'smooth', width: 3 },
        xaxis: {
            categories: generateTimeLabels(12, 'hour'),
            labels: { style: { colors: '#94a3b8' } }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8' } }
        },
        tooltip: { theme: 'dark' }
    });
    
    chart1.render();
    state.charts.monitor1 = chart1;
    
    // Disk Usage Chart
    const chart2 = new ApexCharts(document.querySelector("#monitorChart2"), {
        series: [75],
        chart: {
            height: 250,
            type: 'radialBar'
        },
        plotOptions: {
            radialBar: {
                hollow: { size: '70%' },
                dataLabels: {
                    name: { color: '#94a3b8' },
                    value: { color: '#fff', fontSize: '30px' }
                }
            }
        },
        labels: ['Disk Usage'],
        colors: ['#f59e0b']
    });
    
    chart2.render();
    state.charts.monitor2 = chart2;
    
    // Network Traffic Chart
    const chart3 = new ApexCharts(document.querySelector("#monitorChart3"), {
        series: [{
            name: 'Inbound',
            data: generateTimeSeriesData(6, 10, 100)
        }, {
            name: 'Outbound',
            data: generateTimeSeriesData(6, 5, 80)
        }],
        chart: {
            height: 250,
            type: 'bar',
            stacked: true,
            toolbar: { show: false }
        },
        colors: ['#3b82f6', '#10b981'],
        xaxis: {
            categories: generateTimeLabels(6, 'hour'),
            labels: { style: { colors: '#94a3b8' } }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8' } }
        },
        tooltip: { theme: 'dark' }
    });
    
    chart3.render();
    state.charts.monitor3 = chart3;
}

function startMonitoringUpdates() {
    // Clear existing interval
    if (state.monitoringInterval) {
        clearInterval(state.monitoringInterval);
    }
    
    // Update every 5 seconds
    state.monitoringInterval = setInterval(() => {
        if (state.selectedVPS) {
            updateMonitoringData();
        }
        
        // Update live metrics with random data (in real app, fetch from metrics API)
        const cpu = Math.floor(Math.random() * 30) + 20;
        const ram = Math.floor(Math.random() * 40) + 40;
        const disk = Math.floor(Math.random() * 50) + 10;
        const network = Math.floor(Math.random() * 100) + 20;
        
        document.getElementById('liveCPU').textContent = `${cpu}%`;
        document.getElementById('liveRAM').textContent = `${ram}%`;
        document.getElementById('liveDisk').textContent = `${disk} MB/s`;
        document.getElementById('liveNetwork').textContent = `${network} MB/s`;
        
        // Update charts
        if (state.charts.monitor1) {
            state.charts.monitor1.updateSeries([{
                data: generateTimeSeriesData(12, 20, 80)
            }, {
                data: generateTimeSeriesData(12, 40, 90)
            }]);
        }
        
    }, 5000);
}

function updateMonitoringData(vps = null) {
    if (!vps && state.selectedVPS) {
        vps = state.vpsList.find(v => v.id === state.selectedVPS);
    }
    
    if (!vps) return;
    
    // In a real implementation, fetch metrics from DigitalOcean API
    // For now, generate random data
    const cpuData = generateTimeSeriesData(12, 20, 80);
    const ramData = generateTimeSeriesData(12, 40, 90);
    const diskUsage = Math.floor(Math.random() * 30) + 60;
    
    // Update charts
    if (state.charts.monitor1) {
        state.charts.monitor1.updateSeries([{
            name: 'CPU Usage',
            data: cpuData
        }, {
            name: 'Memory Usage',
            data: ramData
        }]);
    }
    
    if (state.charts.monitor2) {
        state.charts.monitor2.updateSeries([diskUsage]);
    }
}

// =================== UTILITIES ===================
function showModal(title, content, buttons = []) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    
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
            button.className = `btn-action ${btn.style === 'danger' ? 'danger' : ''}`;
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
    
    toast.style.borderLeft = `4px solid ${colors[type]}`;
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
            ${state.activityLog.slice(0, 5).map(item => `
                <div class="notification-item">
                    <i class="fas fa-${getActivityIcon(item.type)} text-${item.type}"></i>
                    <div>
                        <p>${item.message}</p>
                        <span>${item.time}</span>
                    </div>
                </div>
            `).join('')}
        </div>
        `
    );
}

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
                    addActivity('Password changed', 'info');
                    closeModal();
                }
            }
        ]
    );
}

function manageSSHKeys() {
    showModal(
        'SSH Keys',
        `
        <p>Manage your SSH public keys for secure VPS access.</p>
        <div class="ssh-keys-list">
            <div class="ssh-key-item">
                <div class="ssh-key-info">
                    <strong>Default Key</strong>
                    <small>Added: 2024-01-01</small>
                </div>
                <button class="btn-action danger">Remove</button>
            </div>
        </div>
        <div style="margin-top: 20px;">
            <h4>Add New SSH Key</h4>
            <textarea id="newSSHKey" placeholder="Paste your SSH public key here" rows="4" style="width: 100%; margin: 10px 0;"></textarea>
        </div>
        `,
        [
            { text: 'Cancel', action: 'close' },
            { 
                text: 'Add SSH Key', 
                action: () => {
                    const key = document.getElementById('newSSHKey').value.trim();
                    if (!key) {
                        showToast('Please enter SSH key', 'error');
                        return;
                    }
                    
                    if (!key.startsWith('ssh-rsa') && !key.startsWith('ssh-ed25519')) {
                        showToast('Invalid SSH key format', 'error');
                        return;
                    }
                    
                    showToast('SSH key added successfully', 'success');
                    addActivity('SSH key added', 'info');
                    closeModal();
                }
            }
        ]
    );
}

// =================== HELPER FUNCTIONS ===================
function getStatusClass(status) {
    switch(status?.toLowerCase()) {
        case 'active': return 'status-active';
        case 'off':
        case 'stopped': return 'status-stopped';
        case 'pending':
        case 'booting': return 'status-pending';
        default: return 'status-pending';
    }
}

function getOSIcon(osSlug) {
    if (!osSlug) return 'linux';
    
    if (osSlug.includes('ubuntu')) return 'ubuntu';
    if (osSlug.includes('debian')) return 'debian';
    if (osSlug.includes('centos')) return 'centos';
    if (osSlug.includes('fedora')) return 'fedora';
    return 'linux';
}

function getActivityIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

function generateTimeSeriesData(count, min, max) {
    return Array.from({length: count}, () => 
        Math.floor(Math.random() * (max - min + 1)) + min
    );
}

function generateTimeLabels(count, unit) {
    const now = new Date();
    return Array.from({length: count}, (_, i) => {
        const date = new Date(now);
        if (unit === 'hour') {
            date.setHours(date.getHours() - (count - i - 1));
            return date.getHours() + ':00';
        } else {
            date.setDate(date.getDate() - (count - i - 1));
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    });
}

// =================== INITIALIZE ===================
console.log('✅ CloudSphere VPS Manager loaded successfully!');
console.log('🔧 Configuration:', {
    DO_API: CONFIG.DO_API,
    WHITELIST_USERS: CONFIG.WHITELIST_USERS
});