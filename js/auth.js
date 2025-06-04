// Add these functions to your existing index.html script section

// ORCID Configuration
let ORCID_CONFIG;

/**
 * Initialize ORCID configuration from Netlify function
 */
async function initOrcidConfig() {
    try {
        console.log('🔬 Loading ORCID configuration...');
        
        const response = await fetch('/.netlify/functions/orcid-config');
        
        if (!response.ok) {
            throw new Error(`Failed to load ORCID config: ${response.status}`);
        }
        
        const config = await response.json();
        
        ORCID_CONFIG = {
            CLIENT_ID: config.clientId,
            REDIRECT_URI: config.redirectUri,
            BASE_URL: config.baseUrl,
            SCOPE: config.scope
        };
        
        console.log('✅ ORCID configuration loaded successfully');
        
    } catch (error) {
        console.error('❌ Failed to load ORCID configuration:', error);
        throw error;
    }
}

/**
 * Handle ORCID login initiation
 */
function handleOrcidLogin() {
    if (!ORCID_CONFIG) {
        console.error('❌ ORCID configuration not loaded');
        alert('ORCID authentication is not properly configured. Please try again.');
        return;
    }
    
    // Generate random state for security
    const state = generateRandomString(32);
    sessionStorage.setItem('orcid_oauth_state', state);
    
    // Build ORCID authorization URL
    const authUrl = `${ORCID_CONFIG.BASE_URL}/oauth/authorize?` +
        `client_id=${encodeURIComponent(ORCID_CONFIG.CLIENT_ID)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(ORCID_CONFIG.SCOPE)}&` +
        `redirect_uri=${encodeURIComponent(ORCID_CONFIG.REDIRECT_URI)}&` +
        `state=${encodeURIComponent(state)}`;
    
    console.log('🔐 Redirecting to ORCID authorization...');
    console.log('Auth URL:', authUrl);
    
    // Redirect to ORCID
    window.location.href = authUrl;
}

/**
 * Handle ORCID OAuth callback
 */
async function handleOrcidCallback() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        // Check for OAuth errors
        if (error) {
            throw new Error(`ORCID OAuth error: ${error} - ${urlParams.get('error_description')}`);
        }
        
        // Validate state parameter
        const savedState = sessionStorage.getItem('orcid_oauth_state');
        if (!state || state !== savedState) {
            throw new Error('Invalid OAuth state parameter');
        }
        
        // Clean up state
        sessionStorage.removeItem('orcid_oauth_state');
        
        if (!code) {
            throw new Error('No authorization code received from ORCID');
        }
        
        console.log('🔐 Processing ORCID authorization code...');
        
        // Exchange code for token via Netlify function
        const response = await fetch('/.netlify/functions/orcid-callback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                state: state
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to process ORCID authentication');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'ORCID authentication failed');
        }
        
        console.log('✅ ORCID authentication successful:', result.user.orcid);
        
        // Set authentication state
        currentUser = {
            provider: 'orcid',
            orcid: result.user.orcid,
            name: result.user.name?.creditName || 
                  `${result.user.name?.givenNames || ''} ${result.user.name?.familyName || ''}`.trim() ||
                  result.user.orcid,
            email: result.user.email,
            affiliation: result.user.affiliation,
            user_metadata: {
                full_name: result.user.name?.creditName || 
                          `${result.user.name?.givenNames || ''} ${result.user.name?.familyName || ''}`.trim(),
                orcid_id: result.user.orcid,
                affiliation: result.user.affiliation?.organization
            }
        };
        
        isAuthenticated = true;
        
        // Store user data (consider security implications in production)
        localStorage.setItem('orcid_user', JSON.stringify(currentUser));
        
        // Update UI and load interface
        updateAuthUI();
        loadInterface();
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
    } catch (error) {
        console.error('❌ ORCID callback error:', error);
        alert(`ORCID authentication failed: ${error.message}`);
        
        // Clean up URL on error
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show auth message
        showAuthMessage();
    }
}

/**
 * Check for ORCID OAuth callback on page load
 */
function checkOrcidCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if this is an ORCID callback
    if (urlParams.has('code') && urlParams.has('state')) {
        console.log('🔐 Detected ORCID OAuth callback');
        handleOrcidCallback();
        return true;
    }
    
    return false;
}

/**
 * Check for existing ORCID session
 */
function checkExistingOrcidSession() {
    try {
        const storedUser = localStorage.getItem('orcid_user');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            if (userData.provider === 'orcid' && userData.orcid) {
                console.log('✅ Found existing ORCID session:', userData.orcid);
                currentUser = userData;
                isAuthenticated = true;
                updateAuthUI();
                loadInterface();
                return true;
            }
        }
    } catch (error) {
        console.warn('⚠️ Failed to restore ORCID session:', error);
        localStorage.removeItem('orcid_user');
    }
    
    return false;
}

/**
 * Generate random string for OAuth state
 */
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Update your existing updateAuthUI function to include ORCID
 */
function updateAuthUI() {
    const loginSection = document.querySelector('.login-section');
    
    if (isAuthenticated && currentUser) {
        // Show user info and logout button
        const avatar = currentUser.user_metadata?.avatar_url || 
                     (currentUser.provider === 'orcid' ? 
                      `https://orcid.org/sites/default/files/images/orcid_16x16.png` :
                      `https://github.com/${currentUser.user_metadata?.user_name}.png`) ||
                     'https://via.placeholder.com/32';
        
        const name = currentUser.user_metadata?.full_name || 
                   currentUser.name || 
                   currentUser.email || 
                   currentUser.orcid ||
                   'User';

        const providerInfo = currentUser.provider === 'orcid' ? 
            `<span class="provider-badge orcid">ORCID: ${currentUser.orcid}</span>` :
            '<span class="provider-badge github">GitHub</span>';

        loginSection.innerHTML = `
            <div class="user-info">
                <img src="${avatar}" alt="${name}" class="user-avatar" onerror="this.src='https://via.placeholder.com/32'">
                <div class="user-details">
                    <span class="user-name">${name}</span>
                    ${providerInfo}
                </div>
                <button class="logout-btn" onclick="handleLogout()">Sign Out</button>
            </div>
        `;
    } else {
        // Show login options
        loginSection.innerHTML = `
            <div class="auth-options">
                <button class="login-button" onclick="handleLogin()">
                    🔐 Sign in with GitHub
                </button>
                <button class="login-button orcid-button" onclick="handleOrcidLogin()">
                    🔬 Sign in with ORCID
                </button>
            </div>
        `;
    }
}

/**
 * Update your existing handleLogout function to handle ORCID
 */
function handleLogout() {
    if (currentUser?.provider === 'orcid') {
        console.log('👋 Logging out ORCID user...');
        localStorage.removeItem('orcid_user');
    } else if (typeof netlifyIdentity !== 'undefined') {
        console.log('👋 Logging out via Netlify Identity...');
        netlifyIdentity.logout();
        return; // Let Netlify Identity handle the rest
    } else {
        console.log('👋 Logging out...');
    }
    
    // Clear authentication state
    currentUser = null;
    isAuthenticated = false;
    updateAuthUI();
    showAuthMessage();
}

/**
 * Update your existing DOMContentLoaded event
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Research Intelligence Hub...');
    
    try {
        // Initialize ORCID configuration
        await initOrcidConfig();
        
        // Check for OAuth callback first
        if (!checkOrcidCallback()) {
            // Check for existing sessions
            if (!checkExistingOrcidSession()) {
                // Initialize Netlify Identity as fallback
                initializeAuth();
            }
        }
        
        // Load output types configuration
        const config = await loadOutputTypesConfig();
        renderOutputTypes(config);
        
    } catch (error) {
        console.error('💥 Failed to initialize application:', error);
        showConfigError(error);
    }
});
