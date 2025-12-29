// =================== CONFIGURATION ===================
const CONFIG = {
    API_BASE: window.location.origin, // Auto detect current domain
    BOT_USERNAME: "CloudSphereBot",
    VERSION: "1.0.0"
};

// Update semua fetch API calls di app.js:

// Contoh: Fungsi loadVPSData
async function loadVPSData() {
    try {
        console.log('Loading VPS data from:', `${CONFIG.API_BASE}/api/vps`);
        
        const response = await fetch(`${CONFIG.API_BASE}/api/vps`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            appState.vpsList = data.droplets || [];
            console.log(`Loaded ${appState.vpsList.length} VPS`);
        } else {
            // Fallback ke demo data
            appState.vpsList = data.droplets || getDemoVPSData();
            console.log('Using demo data');
        }
        
        document.getElementById('vpsCount').textContent = appState.vpsList.length;
        
    } catch (error) {
        console.error('Error loading VPS:', error);
        appState.vpsList = getDemoVPSData();
        document.getElementById('vpsCount').textContent = appState.vpsList.length;
        showToast('Using demo data. Check API configuration.', 'warning');
    }
}

// Contoh: Fungsi createVPS (di wizard)
async function createVPS() {
    try {
        const name = document.getElementById('vpsName').value;
        const region = appState.createConfig.region;
        const size = getSizeSlug();
        const image = getImageSlug();
        const password = document.getElementById('rootPassword')?.value;
        const enableBackup = document.getElementById('enableBackup')?.checked;
        const enableIPv6 = document.getElementById('enableIPv6')?.checked;
        const enableMonitoring = document.getElementById('enableMonitoring')?.checked;
        
        // Prepare user_data
        let user_data = null;
        if (password) {
            user_data = `#cloud-config
chpasswd:
  list: |
    root:${password}
  expire: false
ssh_pwauth: true`;
        }
        
        const vpsData = {
            name: name,
            region: region,
            size: size,
            image: image,
            backups: enableBackup,
            ipv6: enableIPv6,
            monitoring: enableMonitoring,
            user_data: user_data,
            telegram_id: appState.user?.telegram_id // Untuk notifikasi
        };
        
        showToast('Creating VPS... Please wait (2-3 minutes)', 'info');
        
        const response = await fetch(`${CONFIG.API_BASE}/api/vps/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(vpsData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ VPS created successfully!', 'success');
            
            // Save password locally
            if (password) {
                localStorage.setItem(`vps_password_${data.droplet.id}`, password);
            }
            
            // Redirect ke VPS list
            setTimeout(() => {
                navigateTo('vps');
                loadVPS();
            }, 3000);
            
        } else {
            throw new Error(data.error || 'Failed to create VPS');
        }
        
    } catch (error) {
        console.error('Create VPS error:', error);
        showToast(`❌ Failed: ${error.message}`, 'error');
    }
}

// Contoh: Fungsi login
async function login() {
    const telegramId = document.getElementById('telegramId').value;
    const password = document.getElementById('password').value;
    
    if (!telegramId || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    try {
        showToast('Logging in...', 'info');
        
        const response = await fetch(`${CONFIG.API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegram_id: telegramId,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Save token and user data
            localStorage.setItem('vps_token', data.token);
            localStorage.setItem('vps_user', JSON.stringify(data.user));
            
            appState.user = data.user;
            
            showToast('✅ Login successful!', 'success');
            
            setTimeout(() => {
                showApp();
                loadDashboard();
            }, 1000);
            
        } else {
            throw new Error(data.error || 'Login failed');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showToast(`Login failed: ${error.message}`, 'error');
    }
}
