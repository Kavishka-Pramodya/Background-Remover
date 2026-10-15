/**
 * firebase-config.js — Firebase Configuration & Service Initialization
 * 
 * Configures Firebase Auth, Cloud Firestore, and Firebase Storage.
 * Supports both live Firebase backend and automatic local fallback mode 
 * so the system runs smoothly even before keys are pasted!
 */

const FirebaseConfig = (() => {

    // =========================================================================
    // 1. YOUR FIREBASE CONFIGURATION KEYS
    // Paste the keys you copy from Firebase Console > Project Settings > Web App:
    // =========================================================================
    const DEFAULT_CONFIG = {
        apiKey: "AIzaSyCT9eJpHcar4tnm5qs4aDqRvkpTNcDaMJU",
        authDomain: "syncmart-71ef5.firebaseapp.com",
        projectId: "syncmart-71ef5",
        storageBucket: "syncmart-71ef5.firebasestorage.app",
        messagingSenderId: "838088841055",
        appId: "1:838088841055:web:31bd442e1c0c0d727108ea",
        measurementId: "G-4RYLQW25L2"
    };

    const STORAGE_KEY = 'aura_firebase_custom_config_v1';

    let _app = null;
    let _auth = null;
    let _firestore = null;
    let _storage = null;
    let _isLiveFirebase = false;

    function getActiveConfig() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.apiKey && parsed.projectId) return parsed;
            }
        } catch (e) {
            console.warn('Could not read saved Firebase config', e);
        }
        return DEFAULT_CONFIG;
    }

    function init() {
        const config = getActiveConfig();

        if (config.apiKey && config.projectId && typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps.length) {
                    _app = firebase.initializeApp(config);
                } else {
                    _app = firebase.app();
                }
                _auth = firebase.auth();
                _firestore = firebase.firestore();
                _storage = firebase.storage();
                _isLiveFirebase = true;
                console.log('🔥 Connected to Live Firebase project:', config.projectId);
            } catch (err) {
                console.error('Firebase initialization error, running in local fallback mode:', err);
                _isLiveFirebase = false;
            }
        } else {
            console.log('ℹ️ Firebase keys not yet configured. Operating in Full Local Storage + Mock Backend mode.');
            _isLiveFirebase = false;
        }
    }

    function saveCustomConfig(newConfig) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
        location.reload();
    }

    function clearCustomConfig() {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }

    async function testCloudConnection() {
        if (!_firestore) {
            return {
                status: 'error',
                message: 'Firebase SDK not initialized. Please check apiKey & projectId.'
            };
        }

        try {
            const testRef = _firestore.collection('_system_health').doc('connection_ping');
            await testRef.set({
                timestamp: new Date().toISOString(),
                status: 'connected',
                projectId: getActiveConfig().projectId
            });
            _isLiveFirebase = true;
            return {
                status: 'success',
                message: `🔥 Google Cloud Firestore is 100% CONNECTED & WORKING! (Project: ${getActiveConfig().projectId})`
            };
        } catch (err) {
            console.warn('Firestore connection test failed:', err);
            const errStr = (err && err.message) || String(err);
            if (errStr.includes('does not exist') || errStr.includes('not-found') || (err && err.code === 'not-found')) {
                return {
                    status: 'not_created',
                    message: `⚠️ Cloud Firestore Database has not been created yet in Firebase Console for project "${getActiveConfig().projectId}". Please create the database in Firebase Console first!`
                };
            }
            if ((err && err.code === 'permission-denied') || errStr.includes('permission-denied')) {
                return {
                    status: 'permission_denied',
                    message: `⚠️ Firestore Security Rules blocked access. In Firebase Console > Firestore Database > Rules, set rules to test mode: allow read, write: if true;`
                };
            }
            return {
                status: 'error',
                message: `Firebase error: ${errStr}`
            };
        }
    }

    async function syncAllDataToCloud() {
        const testRes = await testCloudConnection();
        if (testRes.status !== 'success') {
            throw new Error(testRes.message);
        }

        const db = _firestore;
        const products = (typeof StoreManager !== 'undefined') ? StoreManager.getProducts() : [];
        const users = JSON.parse(localStorage.getItem('aura_local_registered_users_v2') || '{}');

        // 1. Sync Products
        for (const p of products) {
            await db.collection('products').doc(p.id).set(p, { merge: true });
        }

        // 2. Sync Users
        for (const email of Object.keys(users)) {
            const u = users[email];
            if (u && u.uid) {
                await db.collection('users').doc(u.uid).set(u, { merge: true });
            }
        }

        return {
            productsCount: products.length,
            usersCount: Object.keys(users).length
        };
    }

    return {
        init,
        isLive: () => _isLiveFirebase,
        getConfig: getActiveConfig,
        saveCustomConfig,
        clearCustomConfig,
        testCloudConnection,
        syncAllDataToCloud,
        getApp: () => _app,
        getAuth: () => _auth,
        getFirestore: () => _firestore,
        getStorage: () => _storage
    };

})();
