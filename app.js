// ================= CONFIGURATION =================
const CONFIG = {
    // API Configuration
    API_URL: 'https://vps-manager-api.vercel.app/api',
    
    // Telegram Configuration
    TELEGRAM_BOT: '@CloudSphereBot',
    TELEGRAM_CHANNEL: '@CloudSphereNews',
    SUPPORT_CHAT: 'https://t.me/CloudSphereSupport',
    
    // App Configuration
    APP_NAME: 'CloudSphere Pro',
    VERSION: '2.0.0',
    
    // Default Settings
    DEFAULT_THEME: 'dark',
    AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_VPS_PER_USER: 10,
    
    // Demo Data (for development)
    DEMO_MODE: true,
    DEMO_USER: {
        id: 1,
        username: 'demo_user',
        email: 'demo@cloudsphere.com',
        name: 'Demo User',
        plan: 'pro',
        created_at: new Date().toISOString(),
        telegram_id: '123456789'
    }
};

// ================= STATE MANAGEMENT =================
const AppState = {
    user: null,
    vpsList: [],
    notifications: [],
    currentPage: 'dashboard',
    charts: {},
    realtimeData: {
        cpu: 0,
        memory: 0,
        network: { in: 0, out: 0 },
        disk: { used: 0, total: 0 }
    },
    theme: localStorage.getItem('theme') || CONFIG.DEFAULT_THEME,
    createVPS: {
        step: 1,
        data: {}
    }
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    checkAuth();
});

function initializeApp() {
    // Set theme
    document.documentElement.setAttribute('data-theme', AppState.theme);
    
    // Check if user prefers dark mode
    if (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        AppState.theme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    // Show loading screen for 2 seconds
    setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 2000);
    
    // Setup demo notifications
    setupDemoNotifications();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Login form
    document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Search input
    document.querySelector('.nav-search input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchVPS(e.target.value);
    });
    
    // Click outside to close dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.style.opacity = '0';
                menu.style.visibility = 'hidden';
            });
        }
        
        if (!e.target.closest('.notification-panel') && !e.target.closest('.notification-btn')) {
            document.getElementById('notificationPanel').classList.remove('show');
        }
    });
}

// ================= AUTHENTICATION =================
function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
        try {
            AppState.user = JSON.parse(userData);
            showApp();
            loadDashboard();
            startRealtimeUpdates();
        } catch (e) {
            showLogin();
        }
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    // Update user info
    if (AppState.user) {
        document.getElementById('displayName').textContent = AppState.user.name || AppState.user.username;
        document.querySelector('.user-plan').textContent = `${AppState.user.plan} Plan`.toUpperCase();
    }
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    // Show loading
    const loginBtn = document.querySelector('.btn-primary');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    loginBtn.disabled = true;
    
    try {
        if (CONFIG.DEMO_MODE) {
            // Demo login
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            AppState.user = CONFIG.DEMO_USER;
            localStorage.setItem('auth_token', 'demo_token_' + Date.now());
            localStorage.setItem('user_data', JSON.stringify(CONFIG.DEMO_USER));
            
            showToast('Welcome to CloudSphere Pro!', 'success');
            showApp();
            loadDashboard();
        } else {
            // Real API call
            const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                AppState.user = data.user;
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                showToast('Login successful!', 'success');
                showApp();
                loadDashboard();
            } else {
                throw new Error('Invalid credentials');
            }
        }
    } catch (error) {
        showToast(error.message || 'Login failed', 'error');
    } finally {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

function loginWithTelegram() {
    showToast('Redirecting to Telegram...', 'info');
    
    // Telegram Web App integration
    if (window.Telegram && Telegram.WebApp) {
        const tg = Telegram.WebApp;
        tg.expand();
        tg.ready();
        
        // Get user data from Telegram
        const user = tg.initDataUnsafe.user;
        if (user) {
            const telegramUser = {
                id: user.id,
                username: user.username,
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                telegram_data: user
            };
            
            // Auto login with Telegram data
            handleTelegramLogin(telegramUser);
        }
    } else {
        // Fallback: Open Telegram bot
        window.open(`https://t.me/${CONFIG.TELEGRAM_BOT.replace('@', '')}?start=web_login`, '_blank');
        showToast('Please complete login in Telegram', 'info');
    }
}

async function handleTelegramLogin(userData) {
    try {
        if (CONFIG.DEMO_MODE) {
            AppState.user = {
                ...CONFIG.DEMO_USER,
                ...userData,
                name: userData.name || CONFIG.DEMO_USER.name
            };
            
            localStorage.setItem('auth_token', 'telegram_token_' + Date.now());
            localStorage.setItem('user_data', JSON.stringify(AppState.user));
            
            showToast('Telegram login successful!', 'success');
            showApp();
            loadDashboard();
        } else {
            const response = await fetch(`${CONFIG.API_URL}/auth/telegram`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                const data = await response.json();
                AppState.user = data.user;
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                showToast('Telegram login successful!', 'success');
                showApp();
                loadDashboard();
            }
        }
    } catch (error) {
        showToast('Telegram login failed', 'error');
    }
}

function handleLogout() {
    Swal.fire({
        title: 'Logout?',
        text: 'Are you sure you want to logout?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, logout',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            AppState.user = null;
            
            // Stop realtime updates
            if (AppState.realtimeInterval) {
                clearInterval(AppState.realtimeInterval);
            }
            
            showToast('Logged out successfully', 'info');
            showLogin();
        }
    });
}

// ================= NAVIGATION =================
function navigateTo(page) {
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    AppState.currentPage = page;
    const mainContent = document.getElementById('mainContent');
    
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'vps':
            loadVPSList();
            break;
        case 'create':
            openCreateVPSModal();
            break;
        case 'monitoring':
            loadMonitoring();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'billing':
            loadBilling();
            break;
        default:
            loadDashboard();
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        document.getElementById('sidebar').classList.remove('show');
    }
}

// ================= DASHBOARD =================
async function loadDashboard() {
    document.getElementById('mainContent').innerHTML = `
        <div class="dashboard-header">
            <h1>Dashboard Overview</h1>
            <p>Welcome back, ${AppState.user?.name || 'User'}! Here's what's happening with your infrastructure.</p>
        </div>
        
        <div class="dashboard-grid">
            <!-- Stats Cards -->
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--gradient-primary);">
                    <i class="fas fa-server"></i>
                </div>
                <div class="stat-content">
                    <p>Active VPS</p>
                    <h3 id="stat-vps">0</h3>
                    <div class="stat-trend trend-up">
                        <i class="fas fa-arrow-up"></i>
                        <span>2 new this month</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--gradient-success);">
                    <i class="fas fa-microchip"></i>
                </div>
                <div class="stat-content">
                    <p>CPU Usage</p>
                    <h3 id="stat-cpu">0%</h3>
                    <div class="stat-trend trend-down">
                        <i class="fas fa-arrow-down"></i>
                        <span>5% from last week</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--gradient-warning);">
                    <i class="fas fa-memory"></i>
                </div>
                <div class="stat-content">
                    <p>Memory Usage</p>
                    <h3 id="stat-ram">0%</h3>
                    <div class="stat-trend trend-up">
                        <i class="fas fa-arrow-up"></i>
                        <span>12% from last week</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--gradient-danger);">
                    <i class="fas fa-hdd"></i>
                </div>
                <div class="stat-content">
                    <p>Storage Usage</p>
                    <h3 id="stat-storage">0%</h3>
                    <div class="stat-trend trend-up">
                        <i class="fas fa-arrow-up"></i>
                        <span>8% from last week</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="charts-grid">
            <div class="chart-container">
                <div class="chart-header">
                    <h3>Resource Usage (24h)</h3>
                    <div class="chart-actions">
                        <button class="btn btn-sm btn-outline" onclick="refreshChart('resource')">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
                <div id="resourceChart" style="height: 300px;"></div>
            </div>
            
            <div class="chart-container">
                <div class="chart-header">
                    <h3>Network Traffic</h3>
                    <div class="chart-actions">
                        <select class="form-control-sm" onchange="updateNetworkChart(this.value)">
                            <option value="24h">Last 24h</option>
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                        </select>
                    </div>
                </div>
                <div id="networkChart" style="height: 300px;"></div>
            </div>
        </div>
        
        <div class="quick-actions-grid">
            <div class="chart-container">
                <div class="chart-header">
                    <h3>Quick Actions</h3>
                </div>
                <div class="quick-actions-buttons">
                    <button class="btn btn-primary" onclick="openCreateVPSModal()">
                        <i class="fas fa-plus"></i>
                        Create VPS
                    </button>
                    <button class="btn btn-outline" onclick="loadVPSList()">
                        <i class="fas fa-server"></i>
                        Manage VPS
                    </button>
                    <button class="btn btn-outline" onclick="openBackupModal()">
                        <i class="fas fa-save"></i>
                        Create Backup
                    </button>
                    <button class="btn btn-outline" onclick="openTerminal()">
                        <i class="fas fa-terminal"></i>
                        Web Terminal
                    </button>
                </div>
            </div>
            
            <div class="chart-container">
                <div class="chart-header">
                    <h3>Recent Activity</h3>
                </div>
                <div class="activity-list" id="activityList">
                    <!-- Activity items will be loaded here -->
                </div>
            </div>
        </div>
    `;
    
    // Load data
    await fetchVPSData();
    initializeCharts();
    loadRecentActivity();
}

async function fetchVPSData() {
    try {
        if (CONFIG.DEMO_MODE) {
            // Demo data
            AppState.vpsList = [
                {
                    id: 1,
                    name: 'web-server-01',
                    status: 'active',
                    region: 'sgp1',
                    size: 's-2vcpu-4gb',
                    image: 'ubuntu-22-04',
                    ip: '104.131.186.241',
                    cpu_usage: 45,
                    memory_usage: 68,
                    disk_usage: 42,
                    created_at: '2024-01-15T10:30:00Z'
                },
                {
                    id: 2,
                    name: 'db-cluster-01',
                    status: 'active',
                    region: 'nyc1',
                    size: 's-4vcpu-8gb',
                    image: 'ubuntu-24-04',
                    ip: '138.197.192.241',
                    cpu_usage: 25,
                    memory_usage: 45,
                    disk_usage: 65,
                    created_at: '2024-02-20T14:45:00Z'
                },
                {
                    id: 3,
                    name: 'dev-server-01',
                    status: 'stopped',
                    region: 'fra1',
                    size: 's-1vcpu-1gb',
                    image: 'debian-11',
                    ip: '165.227.93.89',
                    cpu_usage: 0,
                    memory_usage: 0,
                    disk_usage: 15,
                    created_at: '2024-03-10T09:15:00Z'
                }
            ];
        } else {
            // Real API call
            const response = await fetch(`${CONFIG.API_URL}/vps`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                AppState.vpsList = data.vps || [];
            }
        }
        
        updateDashboardStats();
        
    } catch (error) {
        console.error('Error fetching VPS data:', error);
        showToast('Failed to load VPS data', 'error');
    }
}

function updateDashboardStats() {
    const activeVPS = AppState.vpsList.filter(v => v.status === 'active').length;
    document.getElementById('stat-vps').textContent = activeVPS;
    document.getElementById('vpsCount').textContent = activeVPS;
    
    // Calculate averages
    const avgCPU = AppState.vpsList.reduce((sum, v) => sum + (v.cpu_usage || 0), 0) / Math.max(AppState.vpsList.length, 1);
    const avgRAM = AppState.vpsList.reduce((sum, v) => sum + (v.memory_usage || 0), 0) / Math.max(AppState.vpsList.length, 1);
    const avgStorage = AppState.vpsList.reduce((sum, v) => sum + (v.disk_usage || 0), 0) / Math.max(AppState.vpsList.length, 1);
    
    document.getElementById('stat-cpu').textContent = `${Math.round(avgCPU)}%`;
    document.getElementById('stat-ram').textContent = `${Math.round(avgRAM)}%`;
    document.getElementById('stat-storage').textContent = `${Math.round(avgStorage)}%`;
}

function initializeCharts() {
    // Resource Chart
    const resourceOptions = {
        series: [{
            name: 'CPU Usage',
            data: generateRandomData(24, 10, 80)
        }, {
            name: 'Memory Usage',
            data: generateRandomData(24, 20, 90)
        }, {
            name: 'Disk Usage',
            data: generateRandomData(24, 5, 95)
        }],
        chart: {
            height: 300,
            type: 'area',
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: {
                enabled: true,
                speed: 800
            }
        },
        colors: ['#6366f1', '#10b981', '#f59e0b'],
        dataLabels: { enabled: false },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.2,
                stops: [0, 90, 100]
            }
        },
        xaxis: {
            categories: Array.from({length: 24}, (_, i) => `${i}:00`),
            labels: { style: { colors: AppState.theme === 'dark' ? '#94a3b8' : '#64748b' } }
        },
        yaxis: {
            labels: {
                formatter: (value) => `${value}%`,
                style: { colors: AppState.theme === 'dark' ? '#94a3b8' : '#64748b' }
            },
            min: 0,
            max: 100
        },
        tooltip: {
            theme: AppState.theme,
            x: { format: 'HH:mm' }
        },
        legend: {
            position: 'top',
            labels: { colors: AppState.theme === 'dark' ? '#cbd5e1' : '#475569' }
        },
        grid: {
            borderColor: AppState.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
        }
    };
    
    const resourceChart = new ApexCharts(document.querySelector("#resourceChart"), resourceOptions);
    resourceChart.render();
    AppState.charts.resource = resourceChart;
    
    // Network Chart
    const networkOptions = {
        series: [{
            name: 'Download',
            data: generateRandomData(24, 100, 1000)
        }, {
            name: 'Upload',
            data: generateRandomData(24, 50, 500)
        }],
        chart: {
            height: 300,
            type: 'line',
            toolbar: { show: false }
        },
        colors: ['#6366f1', '#10b981'],
        stroke: {
            curve: 'smooth',
            width: 3
        },
        xaxis: {
            categories: Array.from({length: 24}, (_, i) => `${i}:00`),
            labels: { style: { colors: AppState.theme === 'dark' ? '#94a3b8' : '#64748b' } }
        },
        yaxis: {
            labels: {
                formatter: (value) => `${(value / 1000).toFixed(1)} MB`,
                style: { colors: AppState.theme === 'dark' ? '#94a3b8' : '#64748b' }
            }
        },
        tooltip: {
            theme: AppState.theme,
            x: { format: 'HH:mm' }
        }
    };
    
    const networkChart = new ApexCharts(document.querySelector("#networkChart"), networkOptions);
    networkChart.render();
    AppState.charts.network = networkChart;
}

function generateRandomData(count, min, max) {
    return Array.from({length: count}, () => 
        Math.floor(Math.random() * (max - min + 1)) + min
    );
}

function refreshChart(chartName) {
    if (AppState.charts[chartName]) {
        const newData = generateRandomData(24, 10, 90);
        AppState.charts[chartName].updateSeries([{
            data: newData
        }]);
        showToast('Chart refreshed', 'info');
    }
}

function updateNetworkChart(range) {
    // This would fetch new data based on range
    showToast(`Loading ${range} network data...`, 'info');
}

function loadRecentActivity() {
    const activities = [
        { action: 'Created', target: 'web-server-01', time: '2 hours ago', icon: 'fas fa-plus', color: 'success' },
        { action: 'Stopped', target: 'dev-server-01', time: '5 hours ago', icon: 'fas fa-stop', color: 'danger' },
        { action: 'Backup created', target: 'db-cluster-01', time: '1 day ago', icon: 'fas fa-save', color: 'info' },
        { action: 'Scaled up', target: 'web-server-01', time: '2 days ago', icon: 'fas fa-expand', color: 'warning' },
        { action: 'Firewall updated', target: 'All VPS', time: '3 days ago', icon: 'fas fa-shield-alt', color: 'primary' }
    ];
    
    const activityList = document.getElementById('activityList');
    if (activityList) {
        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.color}">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>${activity.action}</strong> ${activity.target}
                    </div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
    }
}

// ================= VPS MANAGEMENT =================
async function loadVPSList() {
    document.getElementById('mainContent').innerHTML = `
        <div class="vps-header">
            <h1>Virtual Machines</h1>
            <p>Manage your VPS instances, monitor resources, and perform actions.</p>
            <div class="header-actions">
                <button class="btn btn-primary" onclick="openCreateVPSModal()">
                    <i class="fas fa-plus"></i>
                    Create VPS
                </button>
                <button class="btn btn-outline" onclick="refreshVPSList()">
                    <i class="fas fa-sync-alt"></i>
                    Refresh
                </button>
            </div>
        </div>
        
        <div class="vps-filters">
            <div class="filter-group">
                <select class="form-control" onchange="filterVPS('status', this.value)">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="stopped">Stopped</option>
                    <option value="pending">Pending</option>
                </select>
                <select class="form-control" onchange="filterVPS('region', this.value)">
                    <option value="">All Regions</option>
                    <option value="sgp1">Singapore</option>
                    <option value="nyc1">New York</option>
                    <option value="fra1">Frankfurt</option>
                    <option value="blr1">Bangalore</option>
                </select>
                <input type="text" class="form-control" placeholder="Search VPS..." onkeyup="searchVPS(this.value)">
            </div>
        </div>
        
        <div class="vps-table-container">
            <div id="vpsTable">
                <!-- VPS table will be loaded here -->
            </div>
        </div>
    `;
    
    await renderVPSTable();
}

async function renderVPSTable() {
    const tableContainer = document.getElementById('vpsTable');
    if (!tableContainer) return;
    
    if (AppState.vpsList.length === 0) {
        tableContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-server"></i>
                <h3>No Virtual Machines</h3>
                <p>You don't have any VPS instances yet. Create your first one to get started!</p>
                <button class="btn btn-primary" onclick="openCreateVPSModal()">
                    <i class="fas fa-plus"></i>
                    Create Your First VPS
                </button>
            </div>
        `;
        return;
    }
    
    tableContainer.innerHTML = `
        <table class="vps-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Region</th>
                    <th>IP Address</th>
                    <th>Resources</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${AppState.vpsList.map(vps => `
                    <tr>
                        <td>
                            <div class="vps-info">
                                <div class="vps-icon">
                                    <i class="fab fa-${getOSIcon(vps.image)}"></i>
                                </div>
                                <div>
                                    <div class="vps-name">${vps.name}</div>
                                    <div class="vps-specs">${vps.size} | ${vps.image}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="status-badge ${getStatusClass(vps.status)}">
                                <i class="fas fa-circle"></i>
                                ${vps.status}
                            </span>
                        </td>
                        <td>
                            <div class="region-info">
                                <i class="fas fa-globe"></i>
                                ${getRegionName(vps.region)}
                            </div>
                        </td>
                        <td>
                            <div class="ip-address">
                                ${vps.ip}
                                <button class="btn-copy" onclick="copyToClipboard('${vps.ip}')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </td>
                        <td>
                            <div class="resource-bars">
                                <div class="resource-bar">
                                    <div class="resource-label">
                                        <span>CPU</span>
                                        <span>${vps.cpu_usage || 0}%</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${vps.cpu_usage || 0}%; background: #6366f1;"></div>
                                    </div>
                                </div>
                                <div class="resource-bar">
                                    <div class="resource-label">
                                        <span>RAM</span>
                                        <span>${vps.memory_usage || 0}%</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${vps.memory_usage || 0}%; background: #10b981;"></div>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-success" onclick="manageVPS(${vps.id}, 'start')" ${vps.status === 'active' ? 'disabled' : ''}>
                                    <i class="fas fa-play"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="manageVPS(${vps.id}, 'stop')" ${vps.status !== 'active' ? 'disabled' : ''}>
                                    <i class="fas fa-stop"></i>
                                </button>
                                <button class="btn btn-sm btn-warning" onclick="manageVPS(${vps.id}, 'reboot')">
                                    <i class="fas fa-redo"></i>
                                </button>
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-outline">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <div class="dropdown-menu">
                                        <a href="#" onclick="showVPSDetails(${vps.id})"><i class="fas fa-eye"></i> View Details</a>
                                        <a href="#" onclick="openTerminalForVPS(${vps.id})"><i class="fas fa-terminal"></i> Web Terminal</a>
                                        <a href="#" onclick="createSnapshot(${vps.id})"><i class="fas fa-camera"></i> Snapshot</a>
                                        <div class="divider"></div>
                                        <a href="#" onclick="deleteVPS(${vps.id})" class="text-danger"><i class="fas fa-trash"></i> Delete</a>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getOSIcon(os) {
    if (os.includes('ubuntu')) return 'ubuntu';
    if (os.includes('debian')) return 'debian';
    if (os.includes('centos')) return 'centos';
    if (os.includes('fedora')) return 'fedora';
    return 'linux';
}

function getStatusClass(status) {
    switch(status) {
        case 'active': return 'status-active';
        case 'stopped': return 'status-stopped';
        case 'pending': return 'status-pending';
        default: return 'status-unknown';
    }
}

function getRegionName(region) {
    const regions = {
        'sgp1': 'Singapore',
        'nyc1': 'New York',
        'fra1': 'Frankfurt',
        'blr1': 'Bangalore',
        'lon1': 'London',
        'sfo1': 'San Francisco'
    };
    return regions[region] || region;
}

async function manageVPS(vpsId, action) {
    showToast(`${action.charAt(0).toUpperCase() + action.slice(1)}ing VPS...`, 'info');
    
    try {
        if (CONFIG.DEMO_MODE) {
            // Update local state for demo
            const vps = AppState.vpsList.find(v => v.id === vpsId);
            if (vps) {
                vps.status = action === 'start' ? 'active' : 
                            action === 'stop' ? 'stopped' : 
                            action === 'reboot' ? 'pending' : vps.status;
                
                setTimeout(() => {
                    if (action === 'reboot') {
                        vps.status = 'active';
                    }
                    renderVPSTable();
                    showToast(`VPS ${action}ed successfully`, 'success');
                }, 1500);
            }
        } else {
            // Real API call
            const response = await fetch(`${CONFIG.API_URL}/vps/${vpsId}/${action}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (response.ok) {
                showToast(`VPS ${action}ed successfully`, 'success');
                await fetchVPSData();
                renderVPSTable();
            } else {
                throw new Error('Action failed');
            }
        }
    } catch (error) {
        showToast(`Failed to ${action} VPS: ${error.message}`, 'error');
    }
}

function deleteVPS(vpsId) {
    Swal.fire({
        title: 'Delete VPS?',
        html: `
            <p>This action cannot be undone. All data will be permanently deleted.</p>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Warning: This will delete the entire VPS including all data
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                if (CONFIG.DEMO_MODE) {
                    // Remove from demo data
                    AppState.vpsList = AppState.vpsList.filter(v => v.id !== vpsId);
                    return true;
                } else {
                    const response = await fetch(`${CONFIG.API_URL}/vps/${vpsId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                        }
                    });
                    return response.ok;
                }
            } catch (error) {
                throw new Error('Delete failed');
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showToast('VPS deleted successfully', 'success');
            fetchVPSData();
            if (AppState.currentPage === 'vps') {
                renderVPSTable();
            }
        }
    });
}

// ================= CREATE VPS =================
function openCreateVPSModal() {
    AppState.createVPS = { step: 1, data: {} };
    
    document.getElementById('createVPSModal').style.display = 'flex';
    loadCreateVPSStep(1);
}

function loadCreateVPSStep(step) {
    const wizard = document.querySelector('.create-vps-wizard');
    if (!wizard) return;
    
    switch(step) {
        case 1:
            wizard.innerHTML = `
                <div class="wizard-step active">
                    <h3><i class="fas fa-globe"></i> Select Region</h3>
                    <p>Choose a region closest to your users for best performance</p>
                    
                    <div class="regions-grid">
                        <div class="region-card ${AppState.createVPS.data.region === 'sgp1' ? 'selected' : ''}" onclick="selectRegion('sgp1')">
                            <div class="region-icon">
                                <i class="fas fa-flag"></i>
                            </div>
                            <div class="region-info">
                                <h4>Singapore</h4>
                                <p>sgp1 • Low latency for Asia</p>
                                <div class="region-stats">
                                    <span><i class="fas fa-bolt"></i> 15ms avg</span>
                                    <span><i class="fas fa-check"></i> 99.9% uptime</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="region-card ${AppState.createVPS.data.region === 'nyc1' ? 'selected' : ''}" onclick="selectRegion('nyc1')">
                            <div class="region-icon">
                                <i class="fas fa-flag"></i>
                            </div>
                            <div class="region-info">
                                <h4>New York</h4>
                                <p>nyc1 • Best for Americas</p>
                                <div class="region-stats">
                                    <span><i class="fas fa-bolt"></i> 25ms avg</span>
                                    <span><i class="fas fa-check"></i> 99.9% uptime</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="region-card ${AppState.createVPS.data.region === 'fra1' ? 'selected' : ''}" onclick="selectRegion('fra1')">
                            <div class="region-icon">
                                <i class="fas fa-flag"></i>
                            </div>
                            <div class="region-info">
                                <h4>Frankfurt</h4>
                                <p>fra1 • Europe optimized</p>
                                <div class="region-stats">
                                    <span><i class="fas fa-bolt"></i> 20ms avg</span>
                                    <span><i class="fas fa-check"></i> 99.9% uptime</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="wizard-actions">
                        <button class="btn btn-outline" onclick="closeModal('createVPSModal')">Cancel</button>
                        <button class="btn btn-primary" onclick="nextCreateStep()" ${!AppState.createVPS.data.region ? 'disabled' : ''}>
                            Next <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
            break;
            
        case 2:
            wizard.innerHTML = `
                <div class="wizard-step">
                    <h3><i class="fas fa-cogs"></i> Choose Configuration</h3>
                    <p>Select the right plan for your needs</p>
                    
                    <div class="plans-grid">
                        <div class="plan-card ${AppState.createVPS.data.plan === 'basic' ? 'selected' : ''}" onclick="selectPlan('basic')">
                            <div class="plan-header">
                                <h4>Basic</h4>
                                <div class="plan-price">$5<span>/mo</span></div>
                            </div>
                            <div class="plan-features">
                                <div><i class="fas fa-check"></i> 1 vCPU</div>
                                <div><i class="fas fa-check"></i> 1GB RAM</div>
                                <div><i class="fas fa-check"></i> 25GB SSD</div>
                                <div><i class="fas fa-check"></i> 1TB Transfer</div>
                            </div>
                        </div>
                        
                        <div class="plan-card ${AppState.createVPS.data.plan === 'standard' ? 'selected' : ''}" onclick="selectPlan('standard')">
                            <div class="plan-header">
                                <h4>Standard</h4>
                                <div class="plan-price">$20<span>/mo</span></div>
                                <div class="plan-badge">Most Popular</div>
                            </div>
                            <div class="plan-features">
                                <div><i class="fas fa-check"></i> 2 vCPU</div>
                                <div><i class="fas fa-check"></i> 4GB RAM</div>
                                <div><i class="fas fa-check"></i> 80GB SSD</div>
                                <div><i class="fas fa-check"></i> 4TB Transfer</div>
                            </div>
                        </div>
                        
                        <div class="plan-card ${AppState.createVPS.data.plan === 'premium' ? 'selected' : ''}" onclick="selectPlan('premium')">
                            <div class="plan-header">
                                <h4>Premium</h4>
                                <div class="plan-price">$40<span>/mo</span></div>
                            </div>
                            <div class="plan-features">
                                <div><i class="fas fa-check"></i> 4 vCPU</div>
                                <div><i class="fas fa-check"></i> 8GB RAM</div>
                                <div><i class="fas fa-check"></i> 160GB SSD</div>
                                <div><i class="fas fa-check"></i> 5TB Transfer</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="wizard-actions">
                        <button class="btn btn-outline" onclick="prevCreateStep()">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <button class="btn btn-primary" onclick="nextCreateStep()" ${!AppState.createVPS.data.plan ? 'disabled' : ''}>
                            Next <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
            break;
            
        case 3:
            wizard.innerHTML = `
                <div class="wizard-step">
                    <h3><i class="fab fa-linux"></i> Select OS Image</h3>
                    <p>Choose your operating system</p>
                    
                    <div class="os-grid">
                        <div class="os-card ${AppState.createVPS.data.os === 'ubuntu-22-04' ? 'selected' : ''}" onclick="selectOS('ubuntu-22-04')">
                            <i class="fab fa-ubuntu"></i>
                            <h4>Ubuntu 22.04 LTS</h4>
                            <p>Stable, long-term support</p>
                        </div>
                        
                        <div class="os-card ${AppState.createVPS.data.os === 'ubuntu-24-04' ? 'selected' : ''}" onclick="selectOS('ubuntu-24-04')">
                            <i class="fab fa-ubuntu"></i>
                            <h4>Ubuntu 24.04 LTS</h4>
                            <p>Latest, with new features</p>
                        </div>
                        
                        <div class="os-card ${AppState.createVPS.data.os === 'debian-11' ? 'selected' : ''}" onclick="selectOS('debian-11')">
                            <i class="fab fa-debian"></i>
                            <h4>Debian 11</h4>
                            <p>Rock-solid stability</p>
                        </div>
                        
                        <div class="os-card ${AppState.createVPS.data.os === 'centos-7' ? 'selected' : ''}" onclick="selectOS('centos-7')">
                            <i class="fab fa-centos"></i>
                            <h4>CentOS 7</h4>
                            <p>Enterprise-grade</p>
                        </div>
                    </div>
                    
                    <div class="wizard-actions">
                        <button class="btn btn-outline" onclick="prevCreateStep()">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <button class="btn btn-primary" onclick="nextCreateStep()" ${!AppState.createVPS.data.os ? 'disabled' : ''}>
                            Next <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
            break;
            
        case 4:
            wizard.innerHTML = `
                <div class="wizard-step">
                    <h3><i class="fas fa-key"></i> Authentication</h3>
                    <p>Configure how to access your VPS</p>
                    
                    <div class="auth-options">
                        <div class="form-group">
                            <label>VPS Name</label>
                            <input type="text" class="form-control" id="vpsName" placeholder="my-vps-server" value="vps-${Date.now().toString().slice(-6)}">
                        </div>
                        
                        <div class="form-group">
                            <label>Authentication Method</label>
                            <div class="auth-methods">
                                <label class="auth-method ${AppState.createVPS.data.auth === 'password' ? 'selected' : ''}">
                                    <input type="radio" name="auth" value="password" ${AppState.createVPS.data.auth === 'password' ? 'checked' : ''} onchange="selectAuth('password')">
                                    <div class="auth-content">
                                        <i class="fas fa-key"></i>
                                        <div>
                                            <h5>Password</h5>
                                            <p>Set a root password</p>
                                        </div>
                                    </div>
                                </label>
                                
                                <label class="auth-method ${AppState.createVPS.data.auth === 'ssh' ? 'selected' : ''}">
                                    <input type="radio" name="auth" value="ssh" ${AppState.createVPS.data.auth === 'ssh' ? 'checked' : ''} onchange="selectAuth('ssh')">
                                    <div class="auth-content">
                                        <i class="fas fa-fingerprint"></i>
                                        <div>
                                            <h5>SSH Key</h5>
                                            <p>Use SSH key authentication</p>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <div id="authFields">
                            ${AppState.createVPS.data.auth === 'password' ? `
                                <div class="form-group">
                                    <label>Root Password</label>
                                    <input type="password" class="form-control" id="vpsPassword" placeholder="Enter secure password">
                                    <button class="btn btn-sm btn-outline" onclick="generatePassword()" style="margin-top: 10px;">
                                        <i class="fas fa-key"></i> Generate Secure Password
                                    </button>
                                </div>
                            ` : `
                                <div class="form-group">
                                    <label>SSH Public Key</label>
                                    <textarea class="form-control" id="sshKey" rows="4" placeholder="Paste your SSH public key"></textarea>
                                    <button class="btn btn-sm btn-outline" onclick="loadSSHKeys()" style="margin-top: 10px;">
                                        <i class="fas fa-key"></i> Load Saved Keys
                                    </button>
                                </div>
                            `}
                        </div>
                        
                        <div class="form-group">
                            <label>Additional Options</label>
                            <div class="additional-options">
                                <label>
                                    <input type="checkbox" id="enableBackups" checked>
                                    <span>Enable Automatic Backups (+20%)</span>
                                </label>
                                <label>
                                    <input type="checkbox" id="enableIPv6" checked>
                                    <span>Enable IPv6</span>
                                </label>
                                <label>
                                    <input type="checkbox" id="enableMonitoring" checked>
                                    <span>Enable Monitoring</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="wizard-actions">
                        <button class="btn btn-outline" onclick="prevCreateStep()">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <button class="btn btn-primary" onclick="createVPS()">
                            <i class="fas fa-rocket"></i> Create VPS
                        </button>
                    </div>
                </div>
            `;
            break;
    }
}

function selectRegion(region) {
    AppState.createVPS.data.region = region;
    document.querySelectorAll('.region-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.region-card').classList.add('selected');
    document.querySelector('.wizard-actions .btn-primary').disabled = false;
}

function selectPlan(plan) {
    AppState.createVPS.data.plan = plan;
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.plan-card').classList.add('selected');
    document.querySelector('.wizard-actions .btn-primary').disabled = false;
}

function selectOS(os) {
    AppState.createVPS.data.os = os;
    document.querySelectorAll('.os-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.os-card').classList.add('selected');
    document.querySelector('.wizard-actions .btn-primary').disabled = false;
}

function selectAuth(auth) {
    AppState.createVPS.data.auth = auth;
    document.querySelectorAll('.auth-method').forEach(method => {
        method.classList.remove('selected');
    });
    event.target.closest('.auth-method').classList.add('selected');
    
    // Update auth fields
    const authFields = document.getElementById('authFields');
    if (authFields) {
        authFields.innerHTML = auth === 'password' ? `
            <div class="form-group">
                <label>Root Password</label>
                <input type="password" class="form-control" id="vpsPassword" placeholder="Enter secure password">
                <button class="btn btn-sm btn-outline" onclick="generatePassword()" style="margin-top: 10px;">
                    <i class="fas fa-key"></i> Generate Secure Password
                </button>
            </div>
        ` : `
            <div class="form-group">
                <label>SSH Public Key</label>
                <textarea class="form-control" id="sshKey" rows="4" placeholder="Paste your SSH public key"></textarea>
                <button class="btn btn-sm btn-outline" onclick="loadSSHKeys()" style="margin-top: 10px;">
                    <i class="fas fa-key"></i> Load Saved Keys
                </button>
            </div>
        `;
    }
}

function nextCreateStep() {
    AppState.createVPS.step++;
    loadCreateVPSStep(AppState.createVPS.step);
}

function prevCreateStep() {
    AppState.createVPS.step--;
    loadCreateVPSStep(AppState.createVPS.step);
}

function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('vpsPassword').value = password;
}

async function createVPS() {
    const name = document.getElementById('vpsName')?.value;
    const password = document.getElementById('vpsPassword')?.value;
    const sshKey = document.getElementById('sshKey')?.value;
    
    if (!name || (AppState.createVPS.data.auth === 'password' && !password) || 
        (AppState.createVPS.data.auth === 'ssh' && !sshKey)) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const vpsData = {
        ...AppState.createVPS.data,
        name,
        password: AppState.createVPS.data.auth === 'password' ? password : undefined,
        ssh_key: AppState.createVPS.data.auth === 'ssh' ? sshKey : undefined,
        backups: document.getElementById('enableBackups')?.checked || false,
        ipv6: document.getElementById('enableIPv6')?.checked || false,
        monitoring: document.getElementById('enableMonitoring')?.checked || false
    };
    
    showToast('Creating VPS... This may take a few minutes.', 'info');
    
    try {
        if (CONFIG.DEMO_MODE) {
            // Add demo VPS
            const newVPS = {
                id: Date.now(),
                name: vpsData.name,
                status: 'pending',
                region: vpsData.region,
                size: vpsData.plan,
                image: vpsData.os,
                ip: '192.168.1.' + Math.floor(Math.random() * 255),
                cpu_usage: 0,
                memory_usage: 0,
                disk_usage: 0,
                created_at: new Date().toISOString()
            };
            
            AppState.vpsList.push(newVPS);
            
            setTimeout(() => {
                newVPS.status = 'active';
                showToast('VPS created successfully!', 'success');
                closeModal('createVPSModal');
                updateDashboardStats();
                if (AppState.currentPage === 'vps') {
                    renderVPSTable();
                }
            }, 3000);
            
        } else {
            // Real API call
            const response = await fetch(`${CONFIG.API_URL}/vps/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(vpsData)
            });
            
            if (response.ok) {
                showToast('VPS created successfully!', 'success');
                closeModal('createVPSModal');
                await fetchVPSData();
                if (AppState.currentPage === 'vps') {
                    renderVPSTable();
                }
            } else {
                throw new Error('Creation failed');
            }
        }
    } catch (error) {
        showToast('Failed to create VPS: ' + error.message, 'error');
    }
}

// ================= MONITORING =================
async function loadMonitoring() {
    document.getElementById('mainContent').innerHTML = `
        <div class="monitoring-header">
            <h1>Monitoring & Analytics</h1>
            <p>Real-time metrics and performance monitoring for your infrastructure</p>
        </div>
        
        <div class="monitoring-controls">
            <div class="time-range">
                <button class="btn btn-sm ${AppState.monitoringRange === '1h' ? 'btn-primary' : 'btn-outline'}" onclick="setMonitoringRange('1h')">1H</button>
                <button class="btn btn-sm ${AppState.monitoringRange === '24h' ? 'btn-primary' : 'btn-outline'}" onclick="setMonitoringRange('24h')">24H</button>
                <button class="btn btn-sm ${AppState.monitoringRange === '7d' ? 'btn-primary' : 'btn-outline'}" onclick="setMonitoringRange('7d')">7D</button>
                <button class="btn btn-sm ${AppState.monitoringRange === '30d' ? 'btn-primary' : 'btn-outline'}" onclick="setMonitoringRange('30d')">30D</button>
            </div>
            <button class="btn btn-outline" onclick="refreshMonitoring()">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
        </div>
        
        <div class="monitoring-grid">
            <div class="chart-container">
                <div class="chart-header">
                    <h3>CPU Usage</h3>
                    <div class="chart-stats">
                        <span class="stat-value" id="currentCPU">0%</span>
                        <span class="stat-label">Current</span>
                    </div>
                </div>
                <div id="cpuChart" style="height: 250px;"></div>
            </div>
            
            <div class="chart-container">
                <div class="chart-header">
                    <h3>Memory Usage</h3>
                    <div class="chart-stats">
                        <span class="stat-value" id="currentMemory">0%</span>
                        <span class="stat-label">Current</span>
                    </div>
                </div>
                <div id="memoryChart" style="height: 250px;"></div>
            </div>
            
            <div class="chart-container">
                <div class="chart-header">
                    <h3>Disk I/O</h3>
                    <div class="chart-stats">
                        <span class="stat-value" id="currentDiskIO">0 MB/s</span>
                        <span class="stat-label">Current</span>
                    </div>
                </div>
                <div id="diskChart" style="height: 250px;"></div>
            </div>
            
            <div class="chart-container">
                <div class="chart-header">
                    <h3>Network Traffic</h3>
                    <div class="chart-stats">
                        <span class="stat-value" id="currentNetwork">0 MB/s</span>
                        <span class="stat-label">Current</span>
                    </div>
                </div>
                <div id="networkTrafficChart" style="height: 250px;"></div>
            </div>
        </div>
        
        <div class="chart-container full-width">
            <div class="chart-header">
                <h3>Detailed Metrics Timeline</h3>
                <select class="form-control" onchange="updateTimelineChart(this.value)" style="width: 200px;">
                    <option value="all">All Metrics</option>
                    <option value="cpu">CPU Only</option>
                    <option value="memory">Memory Only</option>
                    <option value="disk">Disk Only</option>
                </select>
            </div>
            <div id="timelineChart" style="height: 350px;"></div>
        </div>
        
        <div class="alerts-section">
            <div class="chart-header">
                <h3>Active Alerts</h3>
                <button class="btn btn-sm btn-outline" onclick="createAlert()">
                    <i class="fas fa-plus"></i> New Alert
                </button>
            </div>
            <div class="alerts-list" id="alertsList">
                <!-- Alerts will be loaded here -->
            </div>
        </div>
    `;
    
    initializeMonitoringCharts();
    loadAlerts();
}

function initializeMonitoringCharts() {
    // Generate sample monitoring data
    const timeLabels = Array.from({length: 60}, (_, i) => `${i} min ago`);
    
    // CPU Chart
    const cpuOptions = {
        series: [{
            name: 'CPU Usage',
            data: generateRandomData(60, 10, 90)
        }],
        chart: {
            height: 250,
            type: 'line',
            toolbar: { show: false },
            animations: { enabled: true }
        },
        colors: ['#6366f1'],
        stroke: {
            width: 3,
            curve: 'smooth'
        },
        xaxis: {
            categories: timeLabels,
            labels: { show: false }
        },
        yaxis: {
            labels: {
                formatter: (value) => `${value}%`,
                style: { colors: AppState.theme === 'dark' ? '#94a3b8' : '#64748b' }
            },
            min: 0,
            max: 100
        },
        grid: {
            borderColor: AppState.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            padding: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        tooltip: {
            theme: AppState.theme
        }
    };
    
    const cpuChart = new ApexCharts(document.querySelector("#cpuChart"), cpuOptions);
    cpuChart.render();
    AppState.charts.cpu = cpuChart;
    
    // Update current CPU value
    const currentCPU = Math.floor(Math.random() * 40) + 30;
    document.getElementById('currentCPU').textContent = `${currentCPU}%`;
}

function setMonitoringRange(range) {
    AppState.monitoringRange = range;
    showToast(`Loading ${range} data...`, 'info');
    // In real app, this would fetch new data
}

function refreshMonitoring() {
    showToast('Refreshing monitoring data...', 'info');
    // Refresh all charts
    Object.values(AppState.charts).forEach(chart => {
        if (chart && typeof chart.updateSeries === 'function') {
            chart.updateSeries([{
                data: generateRandomData(60, 10, 90)
            }]);
        }
    });
}

function loadAlerts() {
    const alerts = [
        { type: 'warning', message: 'High CPU usage on web-server-01', time: '10 min ago' },
        { type: 'info', message: 'Backup completed for db-cluster-01', time: '2 hours ago' },
        { type: 'success', message: 'All systems operational', time: '1 day ago' }
    ];
    
    const alertsList = document.getElementById('alertsList');
    if (alertsList) {
        alertsList.innerHTML = alerts.map(alert => `
            <div class="alert-item alert-${alert.type}">
                <div class="alert-icon">
                    <i class="fas fa-${getAlertIcon(alert.type)}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-message">${alert.message}</div>
                    <div class="alert-time">${alert.time}</div>
                </div>
                <button class="btn-copy" onclick="dismissAlert('${alert.message}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }
}

function getAlertIcon(type) {
    switch(type) {
        case 'warning': return 'exclamation-triangle';
        case 'info': return 'info-circle';
        case 'success': return 'check-circle';
        default: return 'bell';
    }
}

// ================= UTILITIES =================
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toastId = 'toast-' + Date.now();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = toastId;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${getToastIcon(type)}"></i>
        </div>
        <div class="toast-content">
            <h4>${type.charAt(0).toUpperCase() + type.slice(1)}</h4>
            <p>${message}</p>
        </div>
        <button class="close-toast" onclick="closeToast('${toastId}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        closeToast(toastId);
    }, 5000);
}

function getToastIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        case 'info': return 'info-circle';
        default: return 'bell';
    }
}

function closeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}

function copyToClipboard(text) {
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Copied to clipboard!', 'success');
    });
}

function toggleTheme() {
    AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', AppState.theme);
    localStorage.setItem('theme', AppState.theme);
    
    // Update charts theme
    Object.values(AppState.charts).forEach(chart => {
        if (chart && typeof chart.updateOptions === 'function') {
            chart.updateOptions({
                theme: { mode: AppState.theme }
            });
        }
    });
    
    showToast(`Switched to ${AppState.theme} theme`, 'info');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('show');
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('loginPassword');
    const icon = document.querySelector('.toggle-password');
    
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

function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function openTelegramBot() {
    window.open(`https://t.me/${CONFIG.TELEGRAM_BOT.replace('@', '')}`, '_blank');
    showToast('Opening Telegram bot...', 'info');
}

function openSupport() {
    window.open(CONFIG.SUPPORT_CHAT, '_blank');
}

function toggleUserMenu() {
    const menu = document.querySelector('.dropdown-menu');
    menu.style.opacity = menu.style.opacity === '1' ? '0' : '1';
    menu.style.visibility = menu.style.visibility === 'visible' ? 'hidden' : 'visible';
}

function showNotifications() {
    document.getElementById('notificationPanel').classList.toggle('show');
}

function closeNotifications() {
    document.getElementById('notificationPanel').classList.remove('show');
}

function setupDemoNotifications() {
    AppState.notifications = [
        { id: 1, title: 'Welcome!', message: 'Welcome to CloudSphere Pro Dashboard', type: 'info', read: false, time: 'Just now' },
        { id: 2, title: 'System Update', message: 'Scheduled maintenance on Jan 15, 2:00 AM UTC', type: 'warning', read: false, time: '1 hour ago' },
        { id: 3, title: 'New Feature', message: 'Web Terminal is now available', type: 'success', read: true, time: '2 days ago' }
    ];
}

function quickCreateVPS() {
    openCreateVPSModal();
}

function startRealtimeUpdates() {
    // Simulate real-time data updates
    AppState.realtimeInterval = setInterval(() => {
        if (AppState.currentPage === 'dashboard' || AppState.currentPage === 'monitoring') {
            // Update random metrics
            AppState.realtimeData.cpu = Math.floor(Math.random() * 40) + 30;
            AppState.realtimeData.memory = Math.floor(Math.random() * 50) + 40;
            
            // Update dashboard stats if on dashboard
            if (AppState.currentPage === 'dashboard') {
                const cpuEl = document.getElementById('stat-cpu');
                const ramEl = document.getElementById('stat-ram');
                if (cpuEl) cpuEl.textContent = `${AppState.realtimeData.cpu}%`;
                if (ramEl) ramEl.textContent = `${AppState.realtimeData.memory}%`;
            }
            
            // Update monitoring charts
            if (AppState.charts.cpu) {
                const newData = generateRandomData(60, 10, 90);
                AppState.charts.cpu.updateSeries([{ data: newData }]);
                
                // Update current value
                const currentCPU = document.getElementById('currentCPU');
                if (currentCPU) {
                    currentCPU.textContent = `${newData[newData.length - 1]}%`;
                }
            }
        }
    }, 5000);
}

// Initialize when page loads
window.onload = initializeApp;
