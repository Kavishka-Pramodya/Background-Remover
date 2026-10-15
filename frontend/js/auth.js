/**
 * auth.js — Role-Based Authentication & User Session Manager
 * 
 * Manages 3 distinct roles:
 * 1. Admin 1 (Default Super Admin: kavishkapramodya2004@gmail.com)
 * 2. Admin 2 (Store Owner 2 — created/managed by Admin 1)
 * 3. Client (Registered shoppers — browse, add to cart, checkout, view orders)
 * 4. Guest (Unregistered visitor — can ONLY browse collection, prompted to sign in to buy)
 */

const AuthManager = (() => {

    const SESSION_KEY = 'aura_auth_current_user_v2';
    const LOCAL_USERS_KEY = 'aura_local_registered_users_v2';

    // Default Super Admin credentials specified by the user
    const DEFAULT_ADMIN_1 = {
        uid: 'admin1-uid-kavishka',
        email: 'kavishkapramodya2004@gmail.com',
        displayName: 'Kavishka Pramodya',
        role: 'admin1',
        storeName: 'Aura Prime Atelier',
        storeCode: 'ADMIN-1',
        phone: '+94 77 123 4567',
        address: 'Colombo, Sri Lanka'
    };

    // Pre-seeded Admin 2 (can be customized or changed by Admin 1)
    const DEFAULT_ADMIN_2 = {
        uid: 'admin2-uid-partner',
        email: 'admin2@aurastudio.com',
        displayName: 'Elena Vance (Admin 2)',
        role: 'admin2',
        storeName: 'Luxe Horizon Curation',
        storeCode: 'ADMIN-2',
        phone: '+94 71 987 6543',
        address: 'Kandy, Sri Lanka'
    };

    // Seed initial registered clients for realistic user management
    const INITIAL_CLIENTS = [
        {
            uid: 'client-seed-1',
            email: 'nipuni.fernando@gmail.com',
            displayName: 'Nipuni Fernando',
            role: 'client',
            phone: '+94 77 912 3456',
            address: 'No 18, Queen\'s Road, Colombo 03',
            password: 'clientpassword1',
            createdAt: '2026-10-12T10:30:00.000Z'
        },
        {
            uid: 'client-seed-2',
            email: 'dinuka.senanayake@live.com',
            displayName: 'Dinuka Senanayake',
            role: 'client',
            phone: '+94 71 884 9201',
            address: '72/A, Kandy Road, Kiribathgoda',
            password: 'clientpassword2',
            createdAt: '2026-10-13T14:15:00.000Z'
        }
    ];

    let _currentUser = null;
    let _listeners = [];
    let _pendingCartProductId = null;

    function init() {
        _seedInitialUsers();
        _restoreSession();
        _bindAuthUI();
    }

    function _seedInitialUsers() {
        try {
            let users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
            if (!users[DEFAULT_ADMIN_1.email]) {
                users[DEFAULT_ADMIN_1.email] = {
                    ...DEFAULT_ADMIN_1,
                    password: '200416604334'
                };
            }
            if (!users[DEFAULT_ADMIN_2.email]) {
                users[DEFAULT_ADMIN_2.email] = {
                    ...DEFAULT_ADMIN_2,
                    password: 'admin2password'
                };
            }
            INITIAL_CLIENTS.forEach(client => {
                if (!users[client.email]) {
                    users[client.email] = { ...client };
                }
            });
            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
        } catch (e) {
            console.error('Failed to seed users', e);
        }
    }

    function _restoreSession() {
        try {
            const saved = localStorage.getItem(SESSION_KEY);
            if (saved) {
                _currentUser = JSON.parse(saved);
            } else {
                // Default guest user
                _currentUser = {
                    uid: 'guest-' + Math.random().toString(36).substr(2, 6),
                    email: null,
                    displayName: 'Guest Visitor',
                    role: 'guest'
                };
            }
        } catch (e) {
            _currentUser = { role: 'guest' };
        }
        _notifyStateChange();
    }

    function onAuthStateChanged(cb) {
        if (typeof cb === 'function') {
            _listeners.push(cb);
            cb(_currentUser);
        }
    }

    function _notifyStateChange() {
        _listeners.forEach(cb => {
            try { cb(_currentUser); } catch (e) { console.error(e); }
        });
        _updateHeaderAuthUI();
        _applyRoleVisibility();
    }

    async function loginWithEmailPassword(email, password) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();

        if (!cleanEmail || !cleanPass) {
            throw new Error('Please enter both email and password.');
        }

        // 1. Check if Live Firebase is active
        if (FirebaseConfig.isLive() && FirebaseConfig.getAuth()) {
            const auth = FirebaseConfig.getAuth();
            const db = FirebaseConfig.getFirestore();

            try {
                const userCred = await auth.signInWithEmailAndPassword(cleanEmail, cleanPass);
                const uid = userCred.user.uid;

                let userDoc = null;
                if (db) {
                    try {
                        const snap = await db.collection('users').doc(uid).get();
                        if (snap.exists) userDoc = snap.data();
                    } catch (e) {
                        console.warn('Firestore fetch user doc error', e);
                    }
                }

                let role = (userDoc && userDoc.role) ? userDoc.role : 'client';
                let storeName = (userDoc && userDoc.storeName) || 'Client Account';

                if (cleanEmail === DEFAULT_ADMIN_1.email) {
                    role = 'admin1';
                    storeName = DEFAULT_ADMIN_1.storeName;
                    if (db) {
                        await db.collection('users').doc(uid).set({
                            email: cleanEmail,
                            displayName: DEFAULT_ADMIN_1.displayName,
                            role: 'admin1',
                            storeName: DEFAULT_ADMIN_1.storeName
                        }, { merge: true });
                    }
                }

                _currentUser = {
                    uid: uid,
                    email: cleanEmail,
                    displayName: userCred.user.displayName || (userDoc && userDoc.displayName) || cleanEmail.split('@')[0],
                    role: role,
                    storeName: storeName,
                    phone: (userDoc && userDoc.phone) || '',
                    address: (userDoc && userDoc.address) || ''
                };

                localStorage.setItem(SESSION_KEY, JSON.stringify(_currentUser));
                _notifyStateChange();
                _handlePendingCartAction();
                return _currentUser;

            } catch (fbErr) {
                console.warn('Firebase login failed, falling back to local user registry:', fbErr);
            }
        }

        // 2. Local Fallback Verification
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
        const found = users[cleanEmail];

        if (found) {
            if (found.password !== cleanPass) {
                throw new Error('Invalid password. Please check and try again.');
            }
            _currentUser = {
                uid: found.uid,
                email: found.email,
                displayName: found.displayName,
                role: found.role,
                storeName: found.storeName || (found.role === 'admin1' ? 'Aura Prime Atelier' : 'Client Account'),
                phone: found.phone || '',
                address: found.address || ''
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(_currentUser));
            _notifyStateChange();
            _handlePendingCartAction();
            return _currentUser;
        }

        throw new Error('No account found with this email. Please click "Sign Up" to create an account.');
    }

    async function registerClient({ name, email, password, phone, address }) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();

        if (!name || !cleanEmail || !cleanPass) {
            throw new Error('Please fill in Name, Email and Password.');
        }

        // Check if user already exists
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
        if (users[cleanEmail]) {
            throw new Error('An account with this email already exists. Please Sign In.');
        }

        const newUser = {
            uid: 'client-' + Date.now(),
            email: cleanEmail,
            displayName: name,
            password: cleanPass,
            role: 'client',
            phone: phone || '',
            address: address || '',
            createdAt: new Date().toISOString()
        };

        // Live Firebase write
        if (FirebaseConfig.isLive() && FirebaseConfig.getAuth()) {
            try {
                const auth = FirebaseConfig.getAuth();
                const db = FirebaseConfig.getFirestore();
                const cred = await auth.createUserWithEmailAndPassword(cleanEmail, cleanPass);
                newUser.uid = cred.user.uid;
                if (db) {
                    await db.collection('users').doc(newUser.uid).set(newUser);
                }
            } catch (err) {
                console.warn('Firebase register error, saved locally:', err);
            }
        }

        users[cleanEmail] = newUser;
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));

        _currentUser = {
            uid: newUser.uid,
            email: newUser.email,
            displayName: newUser.displayName,
            role: newUser.role,
            phone: newUser.phone,
            address: newUser.address
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(_currentUser));
        _notifyStateChange();
        _handlePendingCartAction();
        return _currentUser;
    }

    function _handlePendingCartAction() {
        if (_pendingCartProductId && typeof StoreManager !== 'undefined') {
            const pId = _pendingCartProductId;
            _pendingCartProductId = null;
            setTimeout(() => {
                StoreManager.addToCart(pId);
            }, 300);
        }
    }

    function setPendingCartItem(productId) {
        _pendingCartProductId = productId;
    }

    /**
     * Admin 1 creates / assigns Admin 2
     */
    async function createAdmin2({ name, email, password, storeName }) {
        if (!isAdmin1()) {
            throw new Error('Only Default Super Admin (Admin 1) can register Admin 2.');
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();

        if (!name || !cleanEmail || !cleanPass) {
            throw new Error('Please provide Name, Email, and Password for Admin 2.');
        }

        const newAdmin2Data = {
            uid: 'admin2-' + Date.now(),
            email: cleanEmail,
            displayName: name,
            password: cleanPass,
            role: 'admin2',
            storeName: storeName || 'Partner Atelier',
            storeCode: 'ADMIN-2',
            createdAt: new Date().toISOString()
        };

        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                await db.collection('users').doc(newAdmin2Data.uid).set(newAdmin2Data);
            } catch (e) {
                console.warn('Could not sync Admin 2 to Firestore:', e);
            }
        }

        const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
        users[cleanEmail] = newAdmin2Data;
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));

        return newAdmin2Data;
    }

    function getAllRegisteredClients() {
        try {
            const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
            return Object.values(users).filter(u => u.role === 'client');
        } catch {
            return [];
        }
    }

    function logout() {
        if (FirebaseConfig.isLive() && FirebaseConfig.getAuth()) {
            try {
                FirebaseConfig.getAuth().signOut();
            } catch (e) {
                console.warn(e);
            }
        }
        localStorage.removeItem(SESSION_KEY);
        _currentUser = {
            uid: 'guest-' + Math.random().toString(36).substr(2, 6),
            displayName: 'Guest Visitor',
            role: 'guest'
        };
        _notifyStateChange();

        // If user was on Merchant Studio, return to Collection
        if (window.App && window.App.showScreen) {
            window.App.showScreen('storefront');
        }
        if (window.Utils) Utils.toast('Signed out successfully.', 'info');
    }

    function getCurrentUser() {
        return _currentUser || { role: 'guest' };
    }

    function isAdmin() {
        return _currentUser && (_currentUser.role === 'admin1' || _currentUser.role === 'admin2');
    }

    function isAdmin1() {
        return _currentUser && _currentUser.role === 'admin1';
    }

    function isAdmin2() {
        return _currentUser && _currentUser.role === 'admin2';
    }

    function isClient() {
        return _currentUser && _currentUser.role === 'client';
    }

    function isGuest() {
        return !_currentUser || _currentUser.role === 'guest';
    }

    function _updateHeaderAuthUI() {
        const userBadge = document.getElementById('headerUserBadge');
        const btnAuthModal = document.getElementById('btnOpenAuthModal');
        const currentRolePill = document.getElementById('headerRolePill');
        const currentUserName = document.getElementById('headerUserName');

        if (!userBadge) return;

        if (_currentUser && _currentUser.role !== 'guest') {
            userBadge.classList.remove('hidden');
            if (btnAuthModal) btnAuthModal.classList.add('hidden');

            if (currentUserName) currentUserName.textContent = _currentUser.displayName || _currentUser.email;

            if (currentRolePill) {
                if (_currentUser.role === 'admin1') {
                    currentRolePill.className = 'role-pill role-pill--admin1';
                    currentRolePill.innerHTML = '👑 Admin 1';
                } else if (_currentUser.role === 'admin2') {
                    currentRolePill.className = 'role-pill role-pill--admin2';
                    currentRolePill.innerHTML = '💎 Admin 2';
                } else {
                    currentRolePill.className = 'role-pill role-pill--client';
                    currentRolePill.innerHTML = '🛍️ Customer';
                }
            }
        } else {
            userBadge.classList.add('hidden');
            if (btnAuthModal) btnAuthModal.classList.remove('hidden');
        }
    }

    /**
     * CRITICAL: Merchant Studio navigation button must ONLY be visible to Admin 1 and Admin 2.
     * Guests and Clients must NEVER see the Merchant Studio button.
     */
    function _applyRoleVisibility() {
        const navAdminPortal = document.getElementById('navAdminPortal');
        const btnGoToAdmin = document.getElementById('btnGoToAdmin');
        const admin2ManagementSection = document.getElementById('admin2ManagementSection');
        const adminStoreTitle = document.getElementById('adminActiveStoreTitle');
        const adminWelcomeBadge = document.getElementById('adminWelcomeRoleBadge');

        const isUserAdmin = isAdmin();

        // 1. Merchant Studio in Header: Visible ONLY to Admins!
        if (navAdminPortal) {
            navAdminPortal.style.display = isUserAdmin ? 'inline-flex' : 'none';
            if (isUserAdmin) {
                const pill = navAdminPortal.querySelector('.nav-pill-badge');
                if (pill) pill.textContent = _currentUser.role === 'admin1' ? 'Admin 1' : 'Admin 2';
            }
        }

        // 2. Hero button: Visible ONLY to Admins!
        if (btnGoToAdmin) {
            btnGoToAdmin.style.display = isUserAdmin ? 'inline-flex' : 'none';
        }

        // 3. Admin 2 & User Management tab
        if (admin2ManagementSection) {
            admin2ManagementSection.style.display = isAdmin1() ? 'block' : 'none';
        }

        if (adminStoreTitle && _currentUser) {
            adminStoreTitle.textContent = _currentUser.storeName || 'Merchant Photography & Catalogue';
        }

        if (adminWelcomeBadge && _currentUser) {
            adminWelcomeBadge.textContent = _currentUser.role === 'admin1' 
                ? '👑 Admin 1 · Super Admin' 
                : (_currentUser.role === 'admin2' ? '💎 Admin 2 · Verified Merchant' : 'Customer Account');
        }

        // If non-admin is currently on Admin screen, return to Storefront
        const screenAdmin = document.getElementById('screenAdmin');
        const screenStorefront = document.getElementById('screenStorefront');
        if (!isUserAdmin && screenAdmin && screenAdmin.classList.contains('active')) {
            screenAdmin.classList.remove('active');
            if (screenStorefront) screenStorefront.classList.add('active');
        }
    }

    function openAuthModal(mode = 'signin') {
        const modal = document.getElementById('authModal');
        if (!modal) return;

        const tabSignIn = document.getElementById('authTabBtnSignIn');
        const tabSignUp = document.getElementById('authTabBtnSignUp');
        const viewSignIn = document.getElementById('authViewSignIn');
        const viewSignUp = document.getElementById('authViewSignUp');

        if (mode === 'signup') {
            if (tabSignUp) tabSignUp.classList.add('active');
            if (tabSignIn) tabSignIn.classList.remove('active');
            if (viewSignUp) viewSignUp.classList.remove('hidden');
            if (viewSignIn) viewSignIn.classList.add('hidden');
        } else {
            if (tabSignIn) tabSignIn.classList.add('active');
            if (tabSignUp) tabSignUp.classList.remove('active');
            if (viewSignIn) viewSignIn.classList.remove('hidden');
            if (viewSignUp) viewSignUp.classList.add('hidden');
        }

        if (window.Utils) Utils.show(modal);
    }

    function closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal && window.Utils) Utils.hide(modal);
    }

    function _bindAuthUI() {
        // Wired in HTML and init
    }

    return {
        init,
        onAuthStateChanged,
        loginWithEmailPassword,
        registerClient,
        createAdmin2,
        getAllRegisteredClients,
        logout,
        getCurrentUser,
        isAdmin,
        isAdmin1,
        isAdmin2,
        isClient,
        isGuest,
        setPendingCartItem,
        openAuthModal,
        closeAuthModal,
        DEFAULT_ADMIN_1,
        DEFAULT_ADMIN_2
    };

})();
