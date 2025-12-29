// =================== CONFIGURATION ===================
const CONFIG = {
    // Token sesuai request (dari bot telegram mu)
    BOT_TOKEN: "8593943514:AAFP-TnIvMJ5NJFYo2oUAFxZX_-OFPt35xM",
    DO_TOKEN: "dop_v1_8a3f89f841aeeb2fcec0df1f9b8041775332dca02658531320a7133bbd6b7f6b",
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
        ram: '8', // Default sesuai UI
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
        const loading = document.getElementById('loading');
        if(loading) loading.style.display = 'none';
        checkAuth();
    }, 2000);
    
    setupEventListeners();
});

function setupEventListeners() {
    // Login form enter key
    document.getElementById('password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    
    // Create form inputs
    const vpsName = document.getElementById('vpsName');
    if(vpsName) {
        vpsName.addEventListener('input', function(e) {
            state.createState.name = e.target.value;
            updateReview();
        });
    }
    
    const vpsRegion = document.getElementById('vpsRegion');
    if(vpsRegion) {
        vpsRegion.addEventListener('change', function(e) {
            state.createState.region = e.target.value;
            updateReview();
        });
    }
    
    const vpsOS = document.getElementById('vpsOS');
    if(vpsOS) {
        vpsOS.addEventListener('change', function(e) {
            state.createState.os = e.target.value;
            updateReview();
        });
    }
    
    const rootPass = document.getElementById('rootPassword');
    if(rootPass) {
        rootPass.addEventListener('input', function(e) {
            state.createState.password = e.target.value;
        });
    }
    
    const enableBackup = document.getElementById('enableBackup');
    if(enableBackup) {
        enableBackup.addEventListener('change', updateReview);
    }
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
        const uName = document.getElementById('userName');
        if(uName) uName.textContent = state.user.username;
        
        const uAvt = document.getElementById('userAvatar');
        if(uAvt) uAvt.textContent = state.user.username.charAt(0).toUpperCase();
        
        const setTel = document.getElementById('settingTelegram');
        if(setTel) setTel.textContent = state.user.telegram_id;
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
    
    const userData = {
        id: telegramId,
        telegram_id: telegramId,
        username: `user_${telegramId}`,
        plan: 'Pro',
        created: new Date().toISOString()
    };
    
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
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId);
    if(targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`.nav-item[onclick="showPage('${pageId}')"]`);
    if(navItem) navItem.classList.add('active');
    
    const titles = {
        dashboard: 'Dashboard',
        vps: 'My VPS',
        create: 'Create VPS',
        monitoring: 'Monitoring',
        settings: 'Settings'
    };
    
    const pTitle = document.getElementById('pageTitle');
    if(pTitle) pTitle.textContent = titles[pageId] || 'Dashboard';
    
    switch(pageId) {
        case 'dashboard': loadDashboard(); break;
        case 'vps': loadVPS(); break;
        case 'monitoring': loadMonitoring(); break;
        case 'create': initCreateWizard(); break;
    }
}

// =================== DASHBOARD ===================
async function loadDashboard() {
    try {
        await loadVPSData();
        updateDashboardStats();
        initDashboardCharts();
        loadActivity();
        startDashboardRefresh();
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

async function loadVPSData() {
    try {
        // NOTE: Request dari browser mungkin kena CORS policy DigitalOcean.
        // Solusi: Pakai ekstensi browser CORS Unblock atau jalankan di local server proxy.
        const response = await fetch(`${CONFIG.DO_API}/droplets`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        state.vpsList = data.droplets || [];
        
    } catch (error) {
        console.error('Failed to load VPS:', error);
        throw error;
    }
}

function updateDashboardStats() {
    const totalVPS = state.vpsList.length;
    // Dummy stats karena API metrics butuh request terpisah
    const avgCPU = Math.floor(Math.random() * 30) + 20; 
    
    const elTotal = document.getElementById('totalVPS');
    if(elTotal) elTotal.textContent = totalVPS;
    
    const elCpu = document.getElementById('cpuUsage');
    if(elCpu) elCpu.textContent = `${avgCPU}%`;
    
    const elVpsCount = document.getElementById('vpsCount');
    if(elVpsCount) elVpsCount.textContent = totalVPS;
}

function initDashboardCharts() {
    if(state.charts.dashboard) state.charts.dashboard.destroy();
    if(state.charts.distribution) state.charts.distribution.destroy();
    
    const chartEl1 = document.querySelector("#chart1");
    if(chartEl1) {
        const chart1 = new ApexCharts(chartEl1, {
            series: [{ name: 'CPU', data: [30,40,35,50,49,60,70,91,125] }],
            chart: { height: 250, type: 'area', toolbar: { show: false } },
            stroke: { curve: 'smooth' }
        });
        chart1.render();
        state.charts.dashboard = chart1;
    }
}

function loadActivity() {
    const container = document.getElementById('activityList');
    if(!container) return;
    
    if (state.activityLog.length === 0) {
        state.activityLog = [
            { message: 'System initialized', time: 'Just now', type: 'info' }
        ];
    }
    
    container.innerHTML = state.activityLog.map(item => `
        <div class="activity-item">
            <i class="fas fa-${getActivityIcon(item.type)} text-${item.type}"></i>
            <div><p>${item.message}</p><span>${item.time}</span></div>
        </div>
    `).join('');
}

function addActivity(message, type = 'info') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.activityLog.unshift({ message, time, type });
    if (state.activityLog.length > 10) state.activityLog.pop();
    loadActivity();
}

function startDashboardRefresh() {
    if (state.monitoringInterval) clearInterval(state.monitoringInterval);
    state.monitoringInterval = setInterval(async () => {
        try {
            await loadVPSData();
            updateDashboardStats();
        } catch (e) {}
    }, 30000);
}

// =================== VPS MANAGEMENT ===================
async function loadVPS() {
    try {
        showToast('Loading VPS...', 'info');
        await loadVPSData();
        renderVPSList();
    } catch (error) {
        showToast('Failed to load VPS', 'error');
    }
}

function renderVPSList() {
    const container = document.getElementById('vpsList');
    const noVPS = document.getElementById('noVPS');
    
    if(!container || !noVPS) return;

    if (state.vpsList.length === 0) {
        container.innerHTML = '';
        noVPS.classList.remove('hidden');
        return;
    }
    
    noVPS.classList.add('hidden');
    container.innerHTML = state.vpsList.map(vps => {
        const ip = vps.networks?.v4?.find(n => n.type === 'public')?.ip_address || 'No IP';
        const status = vps.status;
        
        return `
            <div class="vps-card">
                <div class="vps-card-header">
                    <div class="vps-info">
                        <h4>${vps.name}</h4>
                        <p>${vps.region?.slug || vps.region?.name}</p>
                    </div>
                    <div class="vps-status ${getStatusClass(status)}">${status.toUpperCase()}</div>
                </div>
                <div class="vps-specs">
                    <div class="spec-item">IP: ${ip}</div>
                    <div class="spec-item">CPU: ${vps.vcpus}</div>
                    <div class="spec-item">RAM: ${vps.memory}MB</div>
                </div>
                <div class="vps-actions">
                    <button class="action-btn" onclick="vpsAction('${vps.id}', 'power_on')">Start</button>
                    <button class="action-btn" onclick="vpsAction('${vps.id}', 'power_off')">Stop</button>
                    <button class="action-btn danger" onclick="deleteVPS('${vps.id}')">Delete</button>
                    <button class="action-btn" onclick="showVPSDetails('${vps.id}')">Info</button>
                </div>
            </div>
        `;
    }).join('');
}

async function vpsAction(vpsId, action) {
    try {
        showToast(`Executing ${action}...`, 'info');
        const response = await fetch(`${CONFIG.DO_API}/droplets/${vpsId}/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: action })
        });
        
        if (!response.ok) throw new Error('Action failed');
        showToast(`Success: ${action}`, 'success');
        setTimeout(() => loadVPSData().then(renderVPSList), 2000);
    } catch (error) {
        showToast(`Failed to ${action}`, 'error');
    }
}

async function deleteVPS(vpsId) {
    if(!confirm('Are you sure you want to DELETE this VPS?')) return;
    
    try {
        showToast('Deleting VPS...', 'warning');
        const response = await fetch(`${CONFIG.DO_API}/droplets/${vpsId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${CONFIG.DO_TOKEN}` }
        });
        
        if (!response.ok) throw new Error('Delete failed');
        
        showToast('VPS deleted', 'success');
        state.vpsList = state.vpsList.filter(v => v.id !== vpsId);
        renderVPSList();
    } catch (error) {
        showToast('Failed to delete VPS', 'error');
    }
}

function showVPSDetails(vpsId) {
    const vps = state.vpsList.find(v => v.id == vpsId);
    if (!vps) return;
    
    const ip = vps.networks?.v4?.find(n => n.type === 'public')?.ip_address || '-';
    const pass = localStorage.getItem(`vps_pass_${vpsId}`) || state.vpsPasswords[vpsId] || "Not Saved";
    
    showModal('VPS Details', `
        <p><strong>Name:</strong> ${vps.name}</p>
        <p><strong>IP:</strong> ${ip}</p>
        <p><strong>Status:</strong> ${vps.status}</p>
        <hr>
        <p><strong>SSH Command:</strong> <br><code>ssh root@${ip}</code></p>
        <p><strong>Root Password:</strong> <br><code>${pass}</code></p>
    `, [{ text: 'Close', action: 'close' }]);
}

// =================== CREATE VPS WIZARD ===================
function initCreateWizard() {
    state.currentStep = 1;
    state.createState = {
        cpu: 'amd', // Default Selection
        ram: '8',   // Default Selection
        region: 'sgp1',
        os: 'ubuntu-22-04-x64',
        name: `vps-${Date.now().toString().slice(-6)}`,
        password: ''
    };
    
    // UI Reset
    document.querySelectorAll('.create-step').forEach(s => s.classList.remove('active'));
    const step1 = document.getElementById('step1');
    if(step1) step1.classList.add('active');
    
    // Default Input Values
    const nameIn = document.getElementById('vpsName');
    if(nameIn) nameIn.value = state.createState.name;
    
    updateReview();
}

function selectCPU(type) {
    state.createState.cpu = type;
    document.querySelectorAll('.cpu-option').forEach(opt => opt.classList.remove('active'));
    event.currentTarget.classList.add('active');
    updateReview();
}

function selectRAM(size) {
    state.createState.ram = size;
    document.querySelectorAll('.ram-option').forEach(opt => opt.classList.remove('active'));
    event.currentTarget.classList.add('active');
    updateReview();
}

function nextStep(step) {
    // Validasi Name
    if (step === 3) {
        const nameVal = document.getElementById('vpsName').value;
        if (!nameVal) return showToast('Name required', 'error');
        state.createState.name = nameVal;
    }
    // Validasi Password
    if (step === 4) {
        const passVal = document.getElementById('rootPassword').value;
        if (!passVal) return showToast('Password required', 'error');
        state.createState.password = passVal;
    }
    
    document.querySelectorAll('.create-step').forEach(s => s.classList.remove('active'));
    const nextEl = document.getElementById(`step${step}`);
    if(nextEl) nextEl.classList.add('active');
    state.currentStep = step;
    updateReview();
}

function prevStep() {
    if (state.currentStep > 1) nextStep(state.currentStep - 1);
}

function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    
    const passField = document.getElementById('rootPassword');
    if(passField) passField.value = password;
    state.createState.password = password;
}

function updateReview() {
    const elCpu = document.getElementById('reviewCPU');
    if(elCpu) elCpu.textContent = state.createState.cpu.toUpperCase();
    
    const elRam = document.getElementById('reviewRAM');
    if(elRam) elRam.textContent = state.createState.ram + " GB";
    
    const elRegion = document.getElementById('reviewRegion');
    if(elRegion) elRegion.textContent = state.createState.region;
    
    calculatePrice();
}

function calculatePrice() {
    const elPrice = document.getElementById('reviewPrice');
    if(elPrice) elPrice.textContent = "$??"; // Harga dinamis agak kompleks, set placeholder
}

// =================== LOGIC CREATE VPS (FIXED) ===================
async function createVPS() {
    try {
        showToast('🚀 Creating VPS...', 'info');
        
        const name = state.createState.name;
        const region = state.createState.region;
        const image = state.createState.os;
        const password = state.createState.password;
        
        // 1. Get Slug yang Benar (Sesuai Bot Telegram)
        const size = getSizeSlug(); 
        
        // 2. Cloud Config buat Password (Sesuai Bot Telegram)
        const userData = `#cloud-config
chpasswd:
  list: |
    root:${password}
  expire: false
ssh_pwauth: true`;

        // 3. Payload Body (Sesuai Bot Telegram)
        const payload = {
            name: name,
            region: region,
            size: size,
            image: image,
            ipv6: true,         // Wajib true biar sama kayak bot
            monitoring: true,   // Wajib true biar sama kayak bot
            user_data: userData,
            tags: ['cloudsphere'] // Opsional
        };
        
        console.log('Sending Payload:', payload);

        const response = await fetch(`${CONFIG.DO_API}/droplets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.DO_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.message || response.statusText);
        }
        
        const data = await response.json();
        const newId = data.droplet.id;
        
        // Save password local
        state.vpsPasswords[newId] = password;
        localStorage.setItem(`vps_pass_${newId}`, password);
        
        showToast('✅ VPS Created Successfully!', 'success');
        addActivity(`Created VPS: ${name}`, 'success');
        
        // Notifikasi ke Telegram (Opsional)
        if(CONFIG.BOT_TOKEN && state.user?.telegram_id) {
            fetch(`${CONFIG.BOT_API}${CONFIG.BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    chat_id: state.user.telegram_id,
                    text: `✅ VPS Created from Web!\nName: ${name}\nIP: Waiting...`
                })
            }).catch(e => console.log('Tele notif fail', e));
        }
        
        // Redirect ke list
        setTimeout(() => {
            showPage('vps');
            loadVPS();
        }, 2000);

    } catch (error) {
        console.error('Create Error:', error);
        showToast(`Create Failed: ${error.message}`, 'error');
    }
}

// Fungsi Konversi Pilihan UI ke Slug DigitalOcean (PENTING!)
function getSizeSlug() {
    const cpu = state.createState.cpu; // 'amd' atau 'intel'
    const ram = state.createState.ram; // '4', '8', '16', '32'
    
    // Mapping sesuai kode Bot Telegram mu
    if (cpu === 'amd') {
        if (ram === '4') return 's-2vcpu-4gb-amd';
        if (ram === '8') return 's-4vcpu-8gb-amd';
        if (ram === '16') return 's-8vcpu-16gb-amd';
        if (ram === '32') return 's-16vcpu-32gb-amd'; // Asumsi, sesuaikan jika beda
    } 
    else { // Intel
        if (ram === '4') return 's-2vcpu-4gb-intel';
        if (ram === '8') return 's-4vcpu-8gb-intel';
        if (ram === '16') return 's-8vcpu-16gb-intel';
        if (ram === '32') return 's-16vcpu-32gb-intel';
    }
    
    // Fallback default
    return 's-4vcpu-8gb-amd';
}

// =================== UTILITIES ===================
function showModal(title, content, buttons = []) {
    const modal = document.getElementById('modal');
    if(!modal) return;
    
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    
    // Simple button logic (customise as needed)
    // Disini di-simplified biar gak error DOM
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('modal');
    if(modal) modal.style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if(!toast) {
        alert(`${type.toUpperCase()}: ${message}`);
        return;
    }
    
    // Reset isi toast biar simple
    toast.innerHTML = `<span>${message}</span>`;
    toast.className = `toast show ${type}`; // pastikan ada CSS .show
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function hideToast() {
    const toast = document.getElementById('toast');
    if(toast) toast.classList.remove('show');
}

function getStatusClass(status) {
    if(status === 'active') return 'status-active';
    return 'status-pending';
}

function getActivityIcon(type) {
    if(type === 'success') return 'check-circle';
    if(type === 'error') return 'exclamation-circle';
    return 'info-circle';
}

function getOSIcon(slug) {
    if(!slug) return 'server';
    if(slug.includes('ubuntu')) return 'ubuntu';
    return 'linux';
}
