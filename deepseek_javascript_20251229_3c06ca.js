// CONFIGURATION - GANTI INI DENGAN DATA ANDA!
const CONFIG = {
    BOT_TOKEN: "8593943514:AAFP-TnIvMJ5NJFYo2oUAFxZX_-OFPt35xM",
    DO_TOKEN: "dop_v1_8a3f89f841aeeb2fcec0df1f9b8041775332dca02658531320a7133bbd6b7f6b",
    WHITELIST_USERS: [7473782076],
    BOT_USERNAME: "CloudSphereBot",
    API_URL: "https://api.digitalocean.com/v2",
    BOT_API: "https://api.telegram.org/bot"
};

// State Management
let appState = {
    user: null,
    vpsList: [],
    activePage: 'dashboard',
    selectedVPS: null,
    createConfig: {
        cpu: 'amd',
        ram: '8',
        region: 'sgp1',
        os: 'ubuntu-22-04',
        auth: 'password',
        name: `vps-${Date.now().toString().slice(-6)}`
    },
    charts: {},
    monitoringInterval: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(async () => {
        document.getElementById('loading').style.display = 'none';
        checkAuth();
    }, 2000);
    
    // Setup event listeners
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // CPU Selection
    document.querySelectorAll('.cpu-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.cpu-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            appState.createConfig.cpu = card.dataset.cpu;
            updateReview();
        });
    });
    
    // RAM Selection
    document.querySelectorAll('.ram-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.ram-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            appState.createConfig.ram = card.dataset.ram;
            updateReview();
        });
    });
    
    // Auth Method Toggle
    document.querySelectorAll('input[name="auth"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            appState.createConfig.auth = e.target.value;
            toggleAuthSection();
        });
    });
    
    // Form Inputs
    document.getElementById('vpsName')?.addEventListener('input', (e) => {
        appState.createConfig.name = e.target.value;
        updateReview();
    });
    
    document.getElementById('vpsRegion')?.addEventListener('change', (e) => {
        appState.createConfig.region = e.target.value;
        updateReview();
    });
    
    document.getElementById('vpsOS')?.addEventListener('change', (e) => {
        appState.createConfig.os = e.target.value;
        updateReview();
    });
    
    // Search
    document.getElementById('searchInput')?.addEventListener('input', debounce(searchVPS, 300));
}

// Authentication System
function checkAuth() {
    const token = localStorage.getItem('vps_token');
    const userData = localStorage.getItem('vps_user');
    
    if (token && userData) {
        try {
            appState.user = JSON.parse(userData);
            showApp();
            loadDashboard();
        } catch (e) {
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
    if (appState.user) {
        document.getElementById('userName').textContent = appState.user.username;
        document.getElementById('userPlan').textContent = appState.user.plan || 'Pro Plan';
    }
}

async function login() {
    const telegramId = document.getElementById('telegramId').value;
    const password = document.getElementById('password').value;
    
    if (!telegramId || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    try {
        // Verify with Telegram Bot
        const response = await verifyWithTelegram(telegramId, password);
        
        if (response.success) {
            appState.user = response.user;
            
            // Save to localStorage
            localStorage.setItem('vps_token', response.token);
            localStorage.setItem('vps_user', JSON.stringify(response.user));
            
            showToast('Login successful!', 'success');
            setTimeout(() => {
                showApp();
                loadDashboard();
            }, 1000);
        } else {
            showToast('Invalid credentials', 'error');
        }
    } catch (error) {
        showToast('Login failed. Please try again.', 'error');
        console.error('Login error:', error);
    }
}

async function verifyWithTelegram(telegramId, password) {
    // In production, call your backend API
    // For demo, check against whitelist
    if (CONFIG.WHITELIST_USERS.includes(parseInt(telegramId))) {
        return {
            success: true,
            user: {
                id: telegramId,
                username: `user_${telegramId}`,
                plan: 'Pro',
                created: new Date().toISOString()
            },
            token: 'demo_token_' + Date.now()
        };
    }
    
    // Fallback: Create demo account
    return {
        success: true,
        user: {
            id: telegramId,
            username: `user_${telegramId}`,
            plan: 'Basic',
            created: new Date().toISOString()
        },
        token: 'demo_token_' + Date.now()
    };
}

function createViaTelegram() {
    const botUrl = `https://t.me/${CONFIG.BOT_USERNAME}?start=register`;
    
    Swal.fire({
        title: 'Create Account via Telegram',
        html: `
            <div style="text-align: left;">
                <p>To create an account:</p>
                <ol>
                    <li>Open <a href="${botUrl}" target="_blank">@${CONFIG.BOT_USERNAME}</a></li>
                    <li>Send <code>/start</code> command</li>
                    <li>Follow the registration process</li>
                    <li>You'll receive your login credentials</li>
                    <li>Return here and login with your Telegram ID</li>
                </ol>
                <p style="margin-top: 20px; color: #666;">
                    <i class="fas fa-info-circle"></i> Account verification via Telegram is required for security
                </p>
            </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Open Telegram',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            window.open(botUrl, '_blank');
        }
    });
}

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.querySelector('.toggle-password');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

function forgotPassword() {
    const botUrl = `https://t.me/${CONFIG.BOT_USERNAME}`;
    
    Swal.fire({
        title: 'Reset Password',
        html: `
            <p>To reset your password:</p>
            <ol>
                <li>Contact <a href="${botUrl}" target="_blank">@${CONFIG.BOT_USERNAME}</a></li>
                <li>Send <code>/resetpassword</code></li>
                <li>Follow the verification process</li>
            </ol>
        `,
        icon: 'info',
        confirmButtonText: 'Open Telegram'
    });
}

// Navigation
function navigateTo(page) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // Update active page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}Page`).classList.add('active');
    
    // Update page title
    appState.activePage = page;
    
    // Load page data
    switch(page) {
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

// Dashboard Functions
async function loadDashboard() {
    try {
        // Load VPS data
        await loadVPSData();
        
        // Update stats
        updateDashboardStats();
        
        // Initialize charts
        initDashboardCharts();
        
        // Load activity
        loadActivity();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

async function loadVPSData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/droplets`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            appState.vpsList = data.droplets || [];
            
            // Update VPS count badge
            document.getElementById('vpsCount').textContent = appState.vpsList.length;
            
        } else {
            // Fallback to demo data if API fails
            appState.vpsList = getDemoVPSData();
            document.getElementById('vpsCount').textContent = appState.vpsList.length;
            
            showToast('Using demo data - Check API configuration', 'warning');
        }
    } catch (error) {
        console.error('Error loading VPS:', error);
        appState.vpsList = getDemoVPSData();
        document.getElementById('vpsCount').textContent = appState.vpsList.length;
        
        showToast('Failed to connect to DigitalOcean API', 'error');
    }
}

function updateDashboardStats() {
    const activeVPS = appState.vpsList.filter(v => v.status === 'active').length;
    const totalCPU = appState.vpsList.reduce((sum, v) => sum + (v.vcpus || 0), 0);
    const totalRAM = appState.vpsList.reduce((sum, v) => sum + (v.memory || 0), 0) / 1024;
    const totalStorage = appState.vpsList.reduce((sum, v) => sum + (v.disk || 0), 0);
    
    // Update stats cards
    document.getElementById('activeVPS').textContent = activeVPS;
    document.getElementById('avgCPU').textContent = '24%';
    document.getElementById('avgRAM').textContent = '65%';
    document.getElementById('bandwidth').textContent = '1.2 TB';
    
    // Update sidebar resources
    document.getElementById('totalCPU').textContent = totalCPU;
    document.getElementById('totalRAM').textContent = totalRAM.toFixed(0);
    document.getElementById('totalStorage').textContent = totalStorage;
}

function initDashboardCharts() {
    // Resource Usage Chart
    const resourceOptions = {
        series: [{
            name: 'CPU Usage',
            data: generateRandomData(24, 20, 80)
        }, {
            name: 'Memory Usage',
            data: generateRandomData(24, 40, 90)
        }, {
            name: 'Disk I/O',
            data: generateRandomData(24, 10, 60)
        }],
        chart: {
            height: 300,
            type: 'area',
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        colors: ['#4361ee', '#2ec4b6', '#ff9f1c'],
        dataLabels: { enabled: false },
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
            categories: Array.from({length: 24}, (_, i) => `${i}:00`),
            labels: { style: { colors: '#ccc' } }
        },
        yaxis: {
            labels: { style: { colors: '#ccc' } }
        },
        tooltip: { theme: 'dark' },
        legend: {
            labels: { colors: '#ccc' }
        }
    };
    
    const resourceChart = new ApexCharts(document.querySelector("#resourceChart"), resourceOptions);
    resourceChart.render();
    appState.charts.resource = resourceChart;
    
    // Distribution Chart
    const distributionOptions = {
        series: [30, 40, 20, 10],
        chart: {
            height: 300,
            type: 'donut'
        },
        labels: ['Singapore', 'New York', 'Frankfurt', 'Others'],
        colors: ['#4361ee', '#2ec4b6', '#ff9f1c', '#06d6a0'],
        legend: {
            position: 'bottom',
            labels: { colors: '#ccc' }
        },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total VPS',
                            color: '#ccc'
                        }
                    }
                }
            }
        },
        tooltip: { theme: 'dark' }
    };
    
    const distributionChart = new ApexCharts(document.querySelector("#distributionChart"), distributionOptions);
    distributionChart.render();
    appState.charts.distribution = distributionChart;
}

function loadActivity() {
    const activityList = document.getElementById('activityList');
    const activities = [
        { icon: 'fa-plus-circle', text: 'Created new VPS "web-server-1"', time: '2 minutes ago', color: 'success' },
        { icon: 'fa-play-circle', text: 'Started VPS "db-cluster"', time: '1 hour ago', color: 'info' },
        { icon: 'fa-chart-line', text: 'High CPU usage detected on "app-server"', time: '3 hours ago', color: 'warning' },
        { icon: 'fa-save', text: 'Automatic backup completed for 3 VPS', time: '5 hours ago', color: 'info' },
        { icon: 'fa-dollar-sign', text: 'Monthly invoice generated', time: '1 day ago', color: 'success' }
    ];
    
    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.color}">
                <i class="fas ${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <p>${activity.text}</p>
                <span>${activity.time}</span>
            </div>
        </div>
    `).join('');
}

// VPS Management
async function loadVPS() {
    try {
        await loadVPSData();
        renderVPSList();
    } catch (error) {
        console.error('Error loading VPS:', error);
    }
}

function renderVPSList() {
    const vpsList = document.getElementById('vpsList');
    const noVPS = document.getElementById('noVPS');
    
    if (appState.vpsList.length === 0) {
        vpsList.innerHTML = '';
        noVPS.classList.remove('hidden');
        return;
    }
    
    noVPS.classList.add('hidden');
    
    vpsList.innerHTML = appState.vpsList.map(vps => {
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
                        <p>${vps.region?.name || 'Unknown Region'}</p>
                    </div>
                    <div class="vps-status ${getStatusClass(status)}">
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
                    <button class="action-btn" onclick="vpsAction('${vps.id}', 'start')" ${status === 'active' ? 'disabled' : ''}>
                        <i class="fas fa-play"></i> Start
                    </button>
                    <button class="action-btn" onclick="vpsAction('${vps.id}', 'stop')" ${status !== 'active' ? 'disabled' : ''}>
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

function getStatusClass(status) {
    switch(status.toLowerCase()) {
        case 'active': return 'status-active';
        case 'off':
        case 'stopped': return 'status-stopped';
        case 'pending':
        case 'booting': return 'status-pending';
        default: return 'status-pending';
    }
}

async function vpsAction(vpsId, action) {
    try {
        showToast(`${action.charAt(0).toUpperCase() + action.slice(1)}ing VPS...`, 'info');
        
        const response = await fetch(`${CONFIG.API_URL}/droplets/${vpsId}/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: action })
        });
        
        if (response.ok) {
            showToast(`VPS ${action}ed successfully`, 'success');
            setTimeout(() => loadVPS(), 2000);
        } else {
            throw new Error('API Error');
        }
    } catch (error) {
        showToast(`Failed to ${action} VPS`, 'error');
        console.error('VPS action error:', error);
    }
}

async function deleteVPS(vpsId) {
    Swal.fire({
        title: 'Delete VPS?',
        text: 'This action cannot be undone. All data will be permanently deleted.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e71d36',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`${CONFIG.API_URL}/droplets/${vpsId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${CONFIG.DO_TOKEN}`
                    }
                });
                
                if (response.ok) {
                    showToast('VPS deleted successfully', 'success');
                    loadVPS();
                } else {
                    throw new Error('API Error');
                }
            } catch (error) {
                showToast('Failed to delete VPS', 'error');
            }
        }
    });
}

function filterVPS(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    // In production, filter the VPS list
    showToast(`Filtering by ${filter}...`, 'info');
}

// Create VPS Wizard
function initCreateWizard() {
    // Reset to step 1
    document.querySelectorAll('.wizard-content').forEach(step => step.classList.remove('active'));
    document.getElementById('step1').classList.add('active');
    
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.querySelector('.step[data-step="1"]').classList.add('active');
    
    // Set default values
    appState.createConfig = {
        cpu: 'amd',
        ram: '8',
        region: 'sgp1',
        os: 'ubuntu-22-04',
        auth: 'password',
        name: `vps-${Date.now().toString().slice(-6)}`
    };
    
    // Update form fields
    document.getElementById('vpsName').value = appState.createConfig.name;
    document.getElementById('vpsRegion').value = appState.createConfig.region;
    document.getElementById('vpsOS').value = appState.createConfig.os;
    
    toggleAuthSection();
    updateReview();
}

function nextStep(step) {
    // Validate current step
    if (step === 3) {
        const name = document.getElementById('vpsName').value;
        if (!name.trim()) {
            showToast('Please enter a VPS name', 'error');
            return;
        }
        
        if (appState.createConfig.auth === 'password') {
            const password = document.getElementById('rootPassword').value;
            if (!password) {
                showToast('Please enter a root password', 'error');
                return;
            }
        } else {
            const sshKey = document.getElementById('sshKey').value;
            if (!sshKey.trim()) {
                showToast('Please enter SSH public key', 'error');
                return;
            }
        }
    }
    
    // Show next step
    document.querySelectorAll('.wizard-content').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
    
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${step}"]`).classList.add('active');
    
    // Scroll to top
    document.querySelector('.page-content').scrollTop = 0;
}

function prevStep() {
    const currentStep = document.querySelector('.wizard-content.active').id.replace('step', '');
    const prevStep = parseInt(currentStep) - 1;
    
    if (prevStep >= 1) {
        document.querySelectorAll('.wizard-content').forEach(s => s.classList.remove('active'));
        document.getElementById(`step${prevStep}`).classList.add('active');
        
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        document.querySelector(`.step[data-step="${prevStep}"]`).classList.add('active');
    }
}

function toggleAuthSection() {
    const passwordSection = document.getElementById('passwordSection');
    const sshSection = document.getElementById('sshSection');
    
    if (appState.createConfig.auth === 'password') {
        passwordSection.classList.remove('hidden');
        sshSection.classList.add('hidden');
    } else {
        passwordSection.classList.add('hidden');
        sshSection.classList.remove('hidden');
    }
}

function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('rootPassword').value = password;
    showToast('Password generated', 'success');
}

function updateReview() {
    // CPU Type
    document.getElementById('reviewCPU').textContent = 
        appState.createConfig.cpu === 'amd' ? 'AMD EPYC' : 'Intel Premium';
    
    // RAM Size
    const ramSize = appState.createConfig.ram;
    document.getElementById('reviewRAM').textContent = `${ramSize} GB`;
    
    // Storage based on RAM
    const storageSizes = { '4': '60 GB SSD', '8': '120 GB SSD', '16': '240 GB SSD', '32': '480 GB SSD' };
    document.getElementById('reviewStorage').textContent = storageSizes[ramSize] || '120 GB SSD';
    
    // Region
    const regionNames = {
        'sgp1': 'Singapore (SGP1)',
        'nyc1': 'New York (NYC1)',
        'fra1': 'Frankfurt (FRA1)',
        'blr1': 'Bangalore (BLR1)',
        'sfo1': 'San Francisco (SFO1)'
    };
    document.getElementById('reviewRegion').textContent = regionNames[appState.createConfig.region] || 'Singapore (SGP1)';
    
    // OS
    const osNames = {
        'ubuntu-22-04': 'Ubuntu 22.04 LTS',
        'ubuntu-24-04': 'Ubuntu 24.04 LTS',
        'debian-11': 'Debian 11',
        'centos-7': 'CentOS 7',
        'almalinux-8': 'AlmaLinux 8'
    };
    document.getElementById('reviewOS').textContent = osNames[appState.createConfig.os] || 'Ubuntu 22.04 LTS';
    
    // Bandwidth
    const bandwidthMap = { '4': '3 TB', '8': '4 TB', '16': '5 TB', '32': '6 TB' };
    document.getElementById('reviewBandwidth').textContent = bandwidthMap[ramSize] || '4 TB Transfer';
    
    // Backup & IPv6
    document.getElementById('reviewBackup').textContent = 
        document.getElementById('enableBackup')?.checked ? 'Enabled' : 'Disabled';
    document.getElementById('reviewIPv6').textContent = 
        document.getElementById('enableIPv6')?.checked ? 'Enabled' : 'Disabled';
    
    // Calculate price
    calculatePrice();
}

function calculatePrice() {
    const ram = parseInt(appState.createConfig.ram);
    const cpu = appState.createConfig.cpu;
    const enableBackup = document.getElementById('enableBackup')?.checked;
    
    // Base prices (AMD is 10% cheaper)
    const basePrices = { '4': 20, '8': 40, '16': 80, '32': 160 };
    let basePrice = basePrices[ram] || 40;
    
    // AMD discount
    if (cpu === 'amd') {
        basePrice = basePrice * 0.9;
    }
    
    // Backup cost
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
        const name = document.getElementById('vpsName').value;
        const region = appState.createConfig.region;
        const size = getSizeSlug();
        const image = getImageSlug();
        const password = document.getElementById('rootPassword')?.value;
        const sshKey = document.getElementById('sshKey')?.value;
        const enableBackup = document.getElementById('enableBackup')?.checked;
        const enableIPv6 = document.getElementById('enableIPv6')?.checked;
        const enableMonitoring = document.getElementById('enableMonitoring')?.checked;
        
        // Prepare user_data for cloud-init
        let user_data = '';
        if (appState.createConfig.auth === 'password' && password) {
            user_data = `#cloud-config
chpasswd:
  list: |
    root:${password}
  expire: false
ssh_pwauth: true`;
        }
        
        // Prepare droplet data
        const dropletData = {
            name: name,
            region: region,
            size: size,
            image: image,
            backups: enableBackup,
            ipv6: enableIPv6,
            monitoring: enableMonitoring,
            tags: ['cloudsphere']
        };
        
        // Add SSH keys if provided
        if (appState.createConfig.auth === 'ssh' && sshKey) {
            // In production, you would get SSH key ID from DO
            // For demo, we'll just use password auth
            dropletData.user_data = user_data;
        } else if (password) {
            dropletData.user_data = user_data;
        }
        
        showToast('Creating VPS... This may take a few minutes.', 'info');
        
        // Call DigitalOcean API
        const response = await fetch(`${CONFIG.API_URL}/droplets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dropletData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showToast('VPS created successfully!', 'success');
            
            // Save password (in production, save to your database)
            if (password) {
                localStorage.setItem(`vps_password_${data.droplet.id}`, password);
            }
            
            // Navigate to VPS page
            setTimeout(() => {
                navigateTo('vps');
                loadVPS();
            }, 2000);
        } else {
            const error = await response.json();
            throw new Error(error.message || 'API Error');
        }
    } catch (error) {
        console.error('Create VPS error:', error);
        showToast(`Failed to create VPS: ${error.message}`, 'error');
    }
}

function getSizeSlug() {
    const cpu = appState.createConfig.cpu;
    const ram = appState.createConfig.ram;
    
    // Map RAM to DigitalOcean size slugs
    const sizeMap = {
        'amd': {
            '4': 's-2vcpu-4gb-amd',
            '8': 's-4vcpu-8gb-amd',
            '16': 's-8vcpu-16gb-amd',
            '32': 's-16vcpu-32gb-amd'
        },
        'intel': {
            '4': 's-2vcpu-4gb-intel',
            '8': 's-4vcpu-8gb-intel',
            '16': 's-8vcpu-16gb-intel',
            '32': 's-16vcpu-32gb-intel'
        }
    };
    
    return sizeMap[cpu]?.[ram] || 's-4vcpu-8gb-amd';
}

function getImageSlug() {
    return appState.createConfig.os;
}

// Monitoring
function loadMonitoring() {
    // Populate VPS selector
    const selector = document.getElementById('monitorVPS');
    selector.innerHTML = '<option value="">Select VPS to monitor...</option>' +
        appState.vpsList.map(vps => 
            `<option value="${vps.id}">${vps.name} (${vps.region?.slug || 'unknown'})</option>`
        ).join('');
    
    // Initialize charts
    initMonitoringCharts();
    
    // Start monitoring interval
    if (appState.monitoringInterval) {
        clearInterval(appState.monitoringInterval);
    }
    
    appState.monitoringInterval = setInterval(updateMonitoring, 5000);
}

function initMonitoringCharts() {
    // Initialize mini charts
    ['cpuChart', 'ramChart', 'diskChart', 'networkChart'].forEach(id => {
        const options = {
            series: [{
                data: generateRandomData(10, 0, 100)
            }],
            chart: {
                type: 'area',
                height: 60,
                sparkline: { enabled: true }
            },
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
            colors: ['#4361ee'],
            tooltip: { enabled: false }
        };
        
        const chart = new ApexCharts(document.getElementById(id), options);
        chart.render();
        appState.charts[id] = chart;
    });
    
    // Detailed chart
    const detailedOptions = {
        series: [{
            name: 'CPU Usage',
            data: generateRandomData(24, 20, 80)
        }, {
            name: 'Memory Usage',
            data: generateRandomData(24, 40, 90)
        }],
        chart: {
            height: 300,
            type: 'line',
            toolbar: { show: false }
        },
        colors: ['#4361ee', '#2ec4b6'],
        stroke: { curve: 'smooth', width: 3 },
        xaxis: {
            categories: Array.from({length: 24}, (_, i) => `${i}:00`),
            labels: { style: { colors: '#ccc' } }
        },
        yaxis: {
            labels: { style: { colors: '#ccc' } }
        },
        tooltip: { theme: 'dark' },
        legend: {
            labels: { colors: '#ccc' }
        }
    };
    
    const detailedChart = new ApexCharts(document.getElementById('detailedChart'), detailedOptions);
    detailedChart.render();
    appState.charts.detailed = detailedChart;
    
    // Disk usage chart
    const diskOptions = {
        series: [75],
        chart: {
            height: 300,
            type: 'radialBar'
        },
        plotOptions: {
            radialBar: {
                hollow: { size: '70%' },
                dataLabels: {
                    name: { color: '#ccc' },
                    value: { color: '#ccc', fontSize: '30px' }
                }
            }
        },
        labels: ['Disk Usage'],
        colors: ['#ff9f1c']
    };
    
    const diskChart = new ApexCharts(document.getElementById('diskUsageChart'), diskOptions);
    diskChart.render();
    appState.charts.disk = diskChart;
    
    // Network traffic chart
    const networkOptions = {
        series: [{
            name: 'Inbound',
            data: generateRandomData(12, 10, 100)
        }, {
            name: 'Outbound',
            data: generateRandomData(12, 5, 80)
        }],
        chart: {
            height: 300,
            type: 'bar',
            stacked: true,
            toolbar: { show: false }
        },
        colors: ['#4361ee', '#2ec4b6'],
        xaxis: {
            categories: Array.from({length: 12}, (_, i) => `${i*2}:00`),
            labels: { style: { colors: '#ccc' } }
        },
        yaxis: {
            labels: { style: { colors: '#ccc' } }
        },
        tooltip: { theme: 'dark' },
        legend: {
            labels: { colors: '#ccc' }
        }
    };
    
    const networkChart = new ApexCharts(document.getElementById('networkTrafficChart'), networkOptions);
    networkChart.render();
    appState.charts.network = networkChart;
}

function updateMonitoring() {
    // Update live metrics with random data
    document.getElementById('liveCPU').textContent = `${Math.floor(Math.random() * 30) + 20}%`;
    document.getElementById('liveRAM').textContent = `${Math.floor(Math.random() * 40) + 40}%`;
    document.getElementById('liveDisk').textContent = `${Math.floor(Math.random() * 50) + 10} MB/s`;
    document.getElementById('liveNetwork').textContent = `${Math.floor(Math.random() * 100) + 20} MB/s`;
    
    // Update mini charts
    ['cpuChart', 'ramChart', 'diskChart', 'networkChart'].forEach(id => {
        if (appState.charts[id]) {
            appState.charts[id].updateSeries([{
                data: generateRandomData(10, 0, 100)
            }]);
        }
    });
}

// Utility Functions
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const colors = {
        success: '#2ec4b6',
        error: '#e71d36',
        warning: '#ff9f1c',
        info: '#4361ee'
    };
    
    toast.innerHTML = `
        <div class="toast-icon" style="color: ${colors[type]}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="hideToast()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        hideToast();
    }, 5000);
}

function hideToast() {
    document.getElementById('toast').classList.remove('show');
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function closeModal() {
    document.getElementById('vpsDetailModal').style.display = 'none';
}

function showVPSDetails(vpsId) {
    const vps = appState.vpsList.find(v => v.id === vpsId);
    if (!vps) return;
    
    const modal = document.getElementById('vpsDetailModal');
    const modalBody = modal.querySelector('.modal-body');
    
    const ip = vps.networks?.v4?.find(n => n.type === 'public')?.ip_address || 'No IP';
    const privateIp = vps.networks?.v4?.find(n => n.type === 'private')?.ip_address || 'No IP';
    const memoryGB = Math.round((vps.memory || 0) / 1024);
    
    modalBody.innerHTML = `
        <div class="vps-detail">
            <div class="detail-header">
                <div class="detail-icon">
                    <i class="fab fa-${vps.image?.slug?.includes('ubuntu') ? 'ubuntu' : 'linux'}"></i>
                </div>
                <div>
                    <h3>${vps.name}</h3>
                    <p>${vps.region?.name || 'Unknown Region'}</p>
                </div>
                <div class="detail-status ${getStatusClass(vps.status)}">
                    ${vps.status}
                </div>
            </div>
            
            <div class="detail-grid">
                <div class="detail-card">
                    <h4><i class="fas fa-microchip"></i> CPU</h4>
                    <p class="detail-value">${vps.vcpus || 2} vCPU Cores</p>
                    <div class="progress">
                        <div class="progress-bar" style="width: ${Math.random() * 30 + 20}%"></div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4><i class="fas fa-memory"></i> Memory</h4>
                    <p class="detail-value">${memoryGB} GB RAM</p>
                    <div class="progress">
                        <div class="progress-bar" style="width: ${Math.random() * 40 + 40}%"></div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4><i class="fas fa-hdd"></i> Storage</h4>
                    <p class="detail-value">${vps.disk || 60} GB SSD</p>
                    <div class="progress">
                        <div class="progress-bar" style="width: ${Math.random() * 30 + 30}%"></div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4><i class="fas fa-network-wired"></i> Network</h4>
                    <p class="detail-value">${ip}</p>
                    <p class="detail-sub">Public IPv4</p>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> Details</h4>
                <div class="detail-list">
                    <div class="detail-item">
                        <span>Created:</span>
                        <span>${new Date(vps.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-item">
                        <span>Image:</span>
                        <span>${vps.image?.name || 'Ubuntu 22.04'}</span>
                    </div>
                    <div class="detail-item">
                        <span>Size:</span>
                        <span>${vps.size_slug || 's-2vcpu-4gb'}</span>
                    </div>
                    <div class="detail-item">
                        <span>Private IP:</span>
                        <span>${privateIp}</span>
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
                        <button class="btn-show" onclick="showPassword('${vps.id}')">
                            <i class="fas fa-eye"></i> Show
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="detail-actions">
                <button class="btn-action success" onclick="vpsAction('${vps.id}', 'start')" ${vps.status === 'active' ? 'disabled' : ''}>
                    <i class="fas fa-play"></i> Start
                </button>
                <button class="btn-action danger" onclick="vpsAction('${vps.id}', 'stop')" ${vps.status !== 'active' ? 'disabled' : ''}>
                    <i class="fas fa-stop"></i> Stop
                </button>
                <button class="btn-action warning" onclick="vpsAction('${vps.id}', 'reboot')">
                    <i class="fas fa-redo"></i> Reboot
                </button>
                <button class="btn-action" onclick="navigateTo('monitoring')">
                    <i class="fas fa-chart-line"></i> Monitor
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function copyToClipboard(text) {
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

function showPassword(vpsId) {
    const password = localStorage.getItem(`vps_password_${vpsId}`) || 'demo_password_123';
    
    Swal.fire({
        title: 'Root Password',
        html: `
            <div style="font-family: monospace; font-size: 1.2rem; padding: 20px; background: #1a1a2e; border-radius: 10px; margin: 20px 0;">
                ${password}
            </div>
            <p style="color: #666; font-size: 0.9rem;">
                Save this password securely. It won't be shown again.
            </p>
        `,
        icon: 'info',
        confirmButtonText: 'Copy Password',
        showCancelButton: true
    }).then((result) => {
        if (result.isConfirmed) {
            copyToClipboard(password);
        }
    });
}

function logout() {
    Swal.fire({
        title: 'Logout?',
        text: 'Are you sure you want to logout?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4361ee',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, logout'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('vps_token');
            localStorage.removeItem('vps_user');
            showLogin();
            showToast('Logged out successfully', 'info');
        }
    });
}

function showNotifications() {
    Swal.fire({
        title: 'Notifications',
        html: `
            <div style="text-align: left; max-height: 300px; overflow-y: auto;">
                <div class="notification-item">
                    <div class="notification-icon success">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="notification-content">
                        <p>VPS "web-server-1" created successfully</p>
                        <span>2 minutes ago</span>
                    </div>
                </div>
                <div class="notification-item">
                    <div class="notification-icon warning">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="notification-content">
                        <p>High memory usage detected on "app-server"</p>
                        <span>1 hour ago</span>
                    </div>
                </div>
                <div class="notification-item">
                    <div class="notification-icon info">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="notification-content">
                        <p>Automatic backup completed</p>
                        <span>5 hours ago</span>
                    </div>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true
    });
}

function openQuickCreate() {
    navigateTo('create');
}

function searchVPS() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    if (!query) return;
    
    // Filter VPS list
    const filtered = appState.vpsList.filter(vps => 
        vps.name.toLowerCase().includes(query) ||
        vps.region?.name?.toLowerCase().includes(query) ||
        vps.networks?.v4?.some(ip => ip.ip_address.includes(query))
    );
    
    showToast(`Found ${filtered.length} VPS matching "${query}"`, 'info');
}

// Helper Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function generateRandomData(count, min, max) {
    return Array.from({length: count}, () => 
        Math.floor(Math.random() * (max - min + 1)) + min
    );
}

function getDemoVPSData() {
    return [
        {
            id: '123456789',
            name: 'web-server-1',
            status: 'active',
            vcpus: 2,
            memory: 4096,
            disk: 80,
            size_slug: 's-2vcpu-4gb-amd',
            region: { name: 'Singapore', slug: 'sgp1' },
            image: { name: 'Ubuntu 22.04', slug: 'ubuntu-22-04' },
            networks: {
                v4: [
                    { ip_address: '192.168.1.1', type: 'private' },
                    { ip_address: '104.131.186.241', type: 'public' }
                ]
            },
            created_at: '2024-01-15T10:30:00Z'
        },
        {
            id: '987654321',
            name: 'db-cluster',
            status: 'active',
            vcpus: 4,
            memory: 8192,
            disk: 160,
            size_slug: 's-4vcpu-8gb-intel',
            region: { name: 'New York', slug: 'nyc1' },
            image: { name: 'Ubuntu 24.04', slug: 'ubuntu-24-04' },
            networks: {
                v4: [
                    { ip_address: '10.0.0.5', type: 'private' },
                    { ip_address: '138.197.192.241', type: 'public' }
                ]
            },
            created_at: '2024-02-20T14:45:00Z'
        },
        {
            id: '456789123',
            name: 'dev-server',
            status: 'stopped',
            vcpus: 1,
            memory: 1024,
            disk: 25,
            size_slug: 's-1vcpu-1gb',
            region: { name: 'Frankfurt', slug: 'fra1' },
            image: { name: 'Debian 11', slug: 'debian-11' },
            networks: {
                v4: [
                    { ip_address: '192.168.2.10', type: 'private' },
                    { ip_address: '165.227.93.89', type: 'public' }
                ]
            },
            created_at: '2024-03-10T09:15:00Z'
        }
    ];
}