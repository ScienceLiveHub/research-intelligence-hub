// ORCID Configuration and Authentication
// Authentication state variables
let currentUser = null;
let isAuthenticated = false;
let ORCID_CONFIG;

/**
 * Functions that may be called but not defined elsewhere
 */
function showAuthMessage() {
    // For now, just show login options
    updateAuthUI();
}

function loadInterface() {
    // Hide any auth messages and show the main interface
    const protectedContent = document.getElementById('protected-content');
    if (protectedContent) {
        protectedContent.style.display = 'block';
    }
}

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
 * Update authentication UI - ORCID only
 */
/**
 * Update authentication UI - Fixed version
 */
function updateAuthUI() {
    const loginSection = document.querySelector('.login-section');
    
    if (isAuthenticated && currentUser) {
        // Show user info and logout button
        const avatar = 'https://orcid.org/sites/default/files/images/orcid_16x16.png';
        
        // Get user's display name (not ORCID ID)
        const displayName = currentUser.user_metadata?.full_name || 
                           currentUser.name || 
                           currentUser.email || 
                           'ORCID User';

        // Show just the ORCID ID once, not the display name
        const orcidDisplay = currentUser.orcid || 'Unknown';

        loginSection.innerHTML = `
            <div class="user-info">
                <img src="${avatar}" alt="${displayName}" class="user-avatar" onerror="this.src='https://via.placeholder.com/32'">
                <div class="user-details">
                    <span class="user-name">${displayName}</span>
                    <span class="provider-badge orcid">${orcidDisplay}</span>
                </div>
                <div class="user-actions">
                    <button class="profile-btn" onclick="showUserProfile()">Profile</button>
                    <button class="logout-btn" onclick="handleLogout()">Sign Out</button>
                </div>
            </div>
        `;
    } else {
        // Show login options
        loginSection.innerHTML = `
            <div class="auth-options">
                <button class="login-button orcid-button" onclick="handleOrcidLogin()">
                    🔬 Sign in with ORCID
                </button>
            </div>
        `;
    }
}

/**
 * Show user profile modal/section
 */
/**
 * Show user profile modal with server data loading
 */
async function showUserProfile() {
    // Create profile modal
    const modal = document.createElement('div');
    modal.className = 'profile-modal';
    modal.id = 'profile-modal';
    
    const profileData = currentUser || {};
    
    // Show loading state first
    modal.innerHTML = `
        <div class="profile-content">
            <div class="profile-header">
                <h2>User Profile</h2>
                <button class="close-btn" onclick="closeUserProfile()">×</button>
            </div>
            <div class="profile-body">
                <div style="text-align: center; padding: 3rem; color: #64748b;">
                    <div style="margin-bottom: 1rem;">📡</div>
                    <div>Loading profile data...</div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    
    // Load profile data from server
    try {
        const serverProfileData = await loadUserProfile();
        
        // Update modal with loaded data
        modal.innerHTML = `
            <div class="profile-content">
                <div class="profile-header">
                    <h2>User Profile</h2>
                    <button class="close-btn" onclick="closeUserProfile()">×</button>
                </div>
                
                <div class="profile-body">
                    <div class="profile-section">
                        <h3>ORCID Information</h3>
                        <div class="profile-field">
                            <label>ORCID ID:</label>
                            <span>${profileData.orcid || 'Not available'}</span>
                        </div>
                        <div class="profile-field">
                            <label>Name:</label>
                            <span>${profileData.name || 'Not available'}</span>
                        </div>
                        <div class="profile-field">
                            <label>Email:</label>
                            <span>${profileData.email || 'Not available'}</span>
                        </div>
                        <div class="profile-field">
                            <label>Affiliation:</label>
                            <span>${profileData.affiliation?.organization || 'Not available'}</span>
                        </div>
                    </div>
                    
                    <div class="profile-section">
                        <h3>Additional Information</h3>
                        <div class="profile-field">
                            <label for="research-interests">Research Interests:</label>
                            <textarea id="research-interests" placeholder="Enter your research interests...">${serverProfileData['research-interests'] || ''}</textarea>
                        </div>
                        <div class="profile-field">
                            <label for="institution">Institution:</label>
                            <input type="text" id="institution" placeholder="Your institution" value="${serverProfileData['institution'] || ''}">
                        </div>
                        <div class="profile-field">
                            <label for="department">Department:</label>
                            <input type="text" id="department" placeholder="Your department" value="${serverProfileData['department'] || ''}">
                        </div>
                    </div>
                    
                    <div class="profile-actions">
                        <button class="save-btn" onclick="saveUserProfile()">Save Profile</button>
                        <button class="cancel-btn" onclick="closeUserProfile()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading profile data:', error);
        
        // If loading fails, show form with localStorage data as fallback
        const localData = getStoredUserDataLocal();
        
        modal.innerHTML = `
            <div class="profile-content">
                <div class="profile-header">
                    <h2>User Profile</h2>
                    <button class="close-btn" onclick="closeUserProfile()">×</button>
                </div>
                <div class="profile-body">
                    <div style="text-align: center; padding: 1rem; color: #e53e3e; background: #fef5f5; border-radius: 8px; margin-bottom: 1rem;">
                        ⚠️ Could not load profile from server. Using local data.
                    </div>
                    
                    <div class="profile-section">
                        <h3>ORCID Information</h3>
                        <div class="profile-field">
                            <label>ORCID ID:</label>
                            <span>${profileData.orcid || 'Not available'}</span>
                        </div>
                        <div class="profile-field">
                            <label>Name:</label>
                            <span>${profileData.name || 'Not available'}</span>
                        </div>
                        <div class="profile-field">
                            <label>Email:</label>
                            <span>${profileData.email || 'Not available'}</span>
                        </div>
                        <div class="profile-field">
                            <label>Affiliation:</label>
                            <span>${profileData.affiliation?.organization || 'Not available'}</span>
                        </div>
                    </div>
                    
                    <div class="profile-section">
                        <h3>Additional Information</h3>
                        <div class="profile-field">
                            <label for="research-interests">Research Interests:</label>
                            <textarea id="research-interests" placeholder="Enter your research interests...">${localData['research-interests'] || ''}</textarea>
                        </div>
                        <div class="profile-field">
                            <label for="institution">Institution:</label>
                            <input type="text" id="institution" placeholder="Your institution" value="${localData['institution'] || ''}">
                        </div>
                        <div class="profile-field">
                            <label for="department">Department:</label>
                            <input type="text" id="department" placeholder="Your department" value="${localData['department'] || ''}">
                        </div>
                    </div>
                    
                    <div class="profile-actions">
                        <button class="save-btn" onclick="saveUserProfile()">Save Profile</button>
                        <button class="cancel-btn" onclick="closeUserProfile()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }
}
/**
 * Close user profile modal
 */
function closeUserProfile() {
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

/**
 * Save user profile data
 */
async function saveUserProfile() {
    const researchInterests = document.getElementById('research-interests').value;
    const institution = document.getElementById('institution').value;
    const department = document.getElementById('department').value;
    
    // Show loading state
    const saveBtn = document.querySelector('.save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    try {
        // Prepare profile data
        const profileData = {
            'research-interests': researchInterests,
            'institution': institution,
            'department': department
        };
        
        // Send to server
        const response = await fetch('/.netlify/functions/save-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                orcidId: currentUser.orcid,
                profileData: profileData,
                userInfo: {
                    name: currentUser.name,
                    email: currentUser.email,
                    affiliation: currentUser.affiliation
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save profile');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to save profile');
        }
        
        console.log('✅ Profile saved to server');
        
        // Also save to localStorage as backup
        const localData = {
            ...profileData,
            'last-updated': new Date().toISOString(),
            'saved-to-server': true
        };
        localStorage.setItem(`user-profile-${currentUser.orcid}`, JSON.stringify(localData));
        
        alert('Profile saved successfully!');
        closeUserProfile();
        
    } catch (error) {
        console.error('❌ Error saving profile:', error);
        alert(`Error saving profile: ${error.message}`);
    } finally {
        // Reset button state
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}
/**
 * Load user profile data from server (Netlify Blobs)
 */
async function loadUserProfile() {
    if (!currentUser?.orcid) {
        console.warn('No ORCID ID available for loading profile');
        return {};
    }
    
    try {
        console.log('📖 Loading profile from server...');
        
        const response = await fetch(`/.netlify/functions/load-profile?orcid=${encodeURIComponent(currentUser.orcid)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load profile');
        }
        
        if (result.found && result.profile) {
            console.log('✅ Profile loaded from server');
            
            // Also save to localStorage for offline access
            if (result.profile.additionalData) {
                const localData = {
                    ...result.profile.additionalData,
                    'last-updated': result.profile.metadata?.lastUpdated || new Date().toISOString(),
                    'loaded-from-server': true
                };
                localStorage.setItem(`user-profile-${currentUser.orcid}`, JSON.stringify(localData));
            }
            
            return result.profile.additionalData || {};
        } else {
            console.log('📭 No server profile found, checking localStorage...');
            return getStoredUserDataLocal();
        }
        
    } catch (error) {
        console.error('❌ Error loading profile from server:', error);
        console.log('📱 Falling back to localStorage...');
        return getStoredUserDataLocal();
    }
}

/**
 * Get stored user data from localStorage (fallback)
 */
function getStoredUserDataLocal() {
    try {
        const stored = localStorage.getItem(`user-profile-${currentUser.orcid}`);
        if (stored) {
            const data = JSON.parse(stored);
            console.log('📱 Profile loaded from localStorage');
            return data;
        }
    } catch (error) {
        console.warn('Failed to load stored user data:', error);
    }
    return {};
}

/**
 * Get stored user data field (updated to use server)
 */
async function getStoredUserData(field) {
    // If we're in the profile modal, load fresh data from server
    if (document.getElementById('profile-modal')) {
        const profileData = await loadUserProfile();
        return profileData[field] || '';
    }
    
    // Otherwise use cached localStorage data
    return getStoredUserDataLocal()[field] || '';
}
/**
 * Handle logout for both ORCID
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
