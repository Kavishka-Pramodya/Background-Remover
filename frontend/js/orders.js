/**
 * orders.js — Multi-Admin Order Processing, Checkout & Dispatch Messaging
 * 
 * Routes orders specifically to the respective Admin who published each product:
 * - Automatically splits cart items by Admin/Vendor
 * - Saves separate order tickets to Firebase Firestore ('orders' collection) & localStorage
 * - Generates formatted direct dispatch messages for the specific Admin
 * - Provides live order status management (Pending -> Processing -> Shipped -> Delivered)
 */

const OrderManager = (() => {

    const ORDERS_STORAGE_KEY = 'aura_store_orders_v2';
    let _orders = [];
    let _orderChangeListeners = [];

    function init() {
        _loadOrders();
        _bindOrderEvents();
    }

    function _loadOrders() {
        // 1. Try Firestore if Live
        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                db.collection('orders').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
                    _orders = [];
                    snapshot.forEach(doc => {
                        _orders.push({ id: doc.id, ...doc.data() });
                    });
                    _saveLocalOrders();
                    _notifyOrderListeners();
                }, err => {
                    console.warn('Firestore orders live listener failed, using local orders:', err);
                    _loadFromLocal();
                });
                return;
            } catch (e) {
                console.warn('Could not initialize Firestore orders listener:', e);
            }
        }

        // 2. Local Fallback
        _loadFromLocal();
    }

    function _loadFromLocal() {
        try {
            const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
            if (saved) {
                _orders = JSON.parse(saved);
            } else {
                _orders = _getDemoInitialOrders();
                _saveLocalOrders();
            }
        } catch (e) {
            _orders = [];
        }
        _notifyOrderListeners();
    }

    function _saveLocalOrders() {
        try {
            localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(_orders));
        } catch (e) {
            console.error('Failed to save orders locally', e);
        }
    }

    function onOrdersUpdated(cb) {
        if (typeof cb === 'function') {
            _orderChangeListeners.push(cb);
            cb(getOrdersForCurrentAdmin());
        }
    }

    function _notifyOrderListeners() {
        _orderChangeListeners.forEach(cb => {
            try { cb(getOrdersForCurrentAdmin()); } catch (e) { console.error(e); }
        });
        renderAdminOrdersUI();
    }

    /**
     * Get orders specifically assigned to the currently logged in admin.
     * Admin 1 sees Admin 1 orders. Admin 2 sees Admin 2 orders.
     */
    function getOrdersForCurrentAdmin() {
        const user = AuthManager.getCurrentUser();
        if (!user || user.role === 'guest') return [];

        if (user.role === 'admin1') {
            return _orders.filter(o => o.adminRole === 'admin1' || o.adminEmail === AuthManager.DEFAULT_ADMIN_1.email || !o.adminRole);
        }

        if (user.role === 'admin2') {
            return _orders.filter(o => o.adminRole === 'admin2' || o.adminEmail === AuthManager.DEFAULT_ADMIN_2.email);
        }

        if (user.role === 'client') {
            // Client views their own placed orders
            return _orders.filter(o => o.clientEmail === user.email || o.clientUid === user.uid);
        }

        return [];
    }

    /**
     * Process multi-admin checkout:
     * Splits cart items by publisher (Admin 1 vs Admin 2)
     * Creates separate order tickets for each publisher
     */
    async function processCheckout({ customerName, customerPhone, customerEmail, customerAddress, customerCity, notes }) {
        const cart = StoreManager.getCart();
        if (!cart || cart.length === 0) {
            throw new Error('Your cart is empty.');
        }

        if (!customerName || !customerPhone || !customerAddress) {
            throw new Error('Please fill in Customer Name, Contact Number, and Delivery Address.');
        }

        // Group cart items by Admin (product.adminRole or product.adminUid)
        const groups = {};
        cart.forEach(item => {
            const adminKey = item.product.adminRole || 'admin1';
            if (!groups[adminKey]) {
                groups[adminKey] = {
                    adminRole: adminKey,
                    adminName: item.product.adminName || (adminKey === 'admin2' ? 'Admin 2 (Luxe Horizon)' : 'Admin 1 (Aura Prime)'),
                    adminEmail: item.product.adminEmail || (adminKey === 'admin2' ? AuthManager.DEFAULT_ADMIN_2.email : AuthManager.DEFAULT_ADMIN_1.email),
                    adminStoreName: item.product.adminStoreName || (adminKey === 'admin2' ? 'Luxe Horizon Curation' : 'Aura Prime Atelier'),
                    adminPhone: item.product.adminPhone || (adminKey === 'admin2' ? '+94719876543' : '+94771234567'),
                    items: [],
                    subtotal: 0
                };
            }
            groups[adminKey].items.push({
                productId: item.product.id,
                title: item.product.title,
                price: item.product.price,
                quantity: item.quantity,
                image: item.product.image
            });
            groups[adminKey].subtotal += (item.product.price * item.quantity);
        });

        const createdOrders = [];
        const currentUser = AuthManager.getCurrentUser();

        // Create individual order tickets for each admin
        for (const adminKey in groups) {
            const group = groups[adminKey];
            const orderNumber = 'AUR-' + Math.floor(100000 + Math.random() * 900000);
            const orderDocId = 'ord_' + Date.now() + '_' + adminKey;

            const newOrder = {
                id: orderDocId,
                orderNumber: orderNumber,
                createdAt: new Date().toISOString(),
                createdAtFormatted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                status: 'pending', // 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
                
                // Admin routing metadata:
                adminRole: group.adminRole,
                adminName: group.adminName,
                adminEmail: group.adminEmail,
                adminStoreName: group.adminStoreName,
                adminPhone: group.adminPhone,
                
                // Customer details:
                clientUid: currentUser.uid || ('guest-' + Date.now()),
                clientName: customerName,
                clientPhone: customerPhone,
                clientEmail: customerEmail || currentUser.email || 'customer@order.com',
                clientAddress: customerAddress,
                clientCity: customerCity || 'Islandwide',
                clientNotes: notes || 'None',

                // Items & Total:
                items: group.items,
                totalAmount: group.subtotal,
                currency: 'Rs.'
            };

            // 1. Sync to Firebase Firestore if Live
            if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
                try {
                    const db = FirebaseConfig.getFirestore();
                    await db.collection('orders').doc(orderDocId).set({
                        ...newOrder,
                        serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (fbErr) {
                    console.warn('Firestore write order error, saving locally:', fbErr);
                }
            }

            // 2. Add to local memory & storage
            _orders.unshift(newOrder);
            createdOrders.push(newOrder);
        }

        _saveLocalOrders();
        _notifyOrderListeners();

        // Clear shopping cart
        StoreManager.clearCart();

        return createdOrders;
    }

    /**
     * Update order status (Admin function)
     */
    async function updateOrderStatus(orderId, newStatus) {
        const order = _orders.find(o => o.id === orderId);
        if (!order) return;

        order.status = newStatus;
        order.updatedAt = new Date().toISOString();

        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                await db.collection('orders').doc(orderId).update({
                    status: newStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                console.warn('Firestore order status update error:', e);
            }
        }

        _saveLocalOrders();
        _notifyOrderListeners();
        if (window.Utils) Utils.toast(`Order ${order.orderNumber} updated to ${newStatus.toUpperCase()}`, 'success');
    }

    /**
     * Render Orders table in Merchant Studio for the logged in Admin
     */
    function renderAdminOrdersUI() {
        const container = document.getElementById('adminOrdersTableBody');
        const emptyState = document.getElementById('adminOrdersEmptyState');
        const countBadge = document.getElementById('adminOrderCountBadge');
        const pendingBadge = document.getElementById('adminPendingCountBadge');

        if (!container) return;

        const myOrders = getOrdersForCurrentAdmin();

        if (countBadge) countBadge.textContent = myOrders.length;
        if (pendingBadge) {
            const pendingCount = myOrders.filter(o => o.status === 'pending').length;
            pendingBadge.textContent = pendingCount + ' Pending';
            pendingBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
        }

        if (myOrders.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        container.innerHTML = myOrders.map(order => {
            const statusClass = _getStatusBadgeClass(order.status);
            const itemsList = order.items.map(it => `
                <div class="order-item-chip">
                    <img src="${it.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=80&q=80'}" alt="" class="order-item-thumb">
                    <span><strong>${it.quantity}x</strong> ${it.title}</span>
                    <span class="text-muted">(Rs. ${(it.price * it.quantity).toLocaleString()})</span>
                </div>
            `).join('');

            // WhatsApp Direct Dispatch link for the admin to contact client
            const cleanPhone = (order.clientPhone || '').replace(/[^0-9]/g, '');
            const waMsg = encodeURIComponent(
                `Hello ${order.clientName}! Greetings from ${order.adminStoreName}.\n\n` +
                `We received your Order #${order.orderNumber} for:\n` +
                order.items.map(i => `• ${i.quantity}x ${i.title}`).join('\n') +
                `\nTotal: Rs. ${order.totalAmount.toLocaleString()}\n` +
                `Status: ${order.status.toUpperCase()}\n` +
                `Delivery to: ${order.clientAddress}, ${order.clientCity}\n\n` +
                `Thank you for shopping with us!`
            );
            const waUrl = `https://wa.me/${cleanPhone}?text=${waMsg}`;

            return `
                <tr class="order-table-row">
                    <td>
                        <div class="order-num-col">
                            <strong>${order.orderNumber}</strong>
                            <span class="order-date">${order.createdAtFormatted || 'Recent'}</span>
                            <span class="badge badge--dark" style="font-size: 10px;">${order.adminRole === 'admin2' ? 'Admin 2 Store' : 'Admin 1 Store'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="customer-info-col">
                            <strong>${order.clientName}</strong>
                            <div class="customer-phone">📞 <a href="tel:${order.clientPhone}">${order.clientPhone}</a></div>
                            <div class="customer-address">📍 ${order.clientAddress}, ${order.clientCity}</div>
                            ${order.clientNotes && order.clientNotes !== 'None' ? `<div class="customer-notes">💬 Note: "${order.clientNotes}"</div>` : ''}
                        </div>
                    </td>
                    <td>
                        <div class="order-items-col">
                            ${itemsList}
                        </div>
                    </td>
                    <td>
                        <div class="order-total-col">
                            <strong>Rs. ${order.totalAmount.toLocaleString()}</strong>
                            <span class="text-muted" style="font-size: 11px;">Direct Dispatch</span>
                        </div>
                    </td>
                    <td>
                        <div class="order-status-col">
                            <span class="status-badge ${statusClass}">${order.status.toUpperCase()}</span>
                            <select class="order-status-select" onchange="OrderManager.updateOrderStatus('${order.id}', this.value)">
                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                                <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </div>
                    </td>
                    <td>
                        <div class="order-actions-col">
                            <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn--outline btn--xs" title="Message customer on WhatsApp">
                                💬 WhatsApp Client
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function _getStatusBadgeClass(status) {
        switch (status) {
            case 'pending': return 'badge--warning';
            case 'processing': return 'badge--info';
            case 'shipped': return 'badge--primary';
            case 'delivered': return 'badge--success';
            case 'cancelled': return 'badge--danger';
            default: return 'badge--secondary';
        }
    }

    function _getDemoInitialOrders() {
        return [
            {
                id: 'ord_demo_1',
                orderNumber: 'AUR-58291',
                createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
                createdAtFormatted: 'Today, 2:15 PM',
                status: 'pending',
                adminRole: 'admin1',
                adminName: 'Kavishka Pramodya (Admin 1)',
                adminEmail: 'kavishkapramodya2004@gmail.com',
                adminStoreName: 'Aura Prime Atelier',
                clientUid: 'client-demo-1',
                clientName: 'Nipuni Fernando',
                clientPhone: '+94 77 912 3456',
                clientEmail: 'nipuni@gmail.com',
                clientAddress: 'No 18, Queen\'s Road',
                clientCity: 'Colombo 03',
                clientNotes: 'Please deliver after 4 PM.',
                items: [
                    {
                        productId: 'prod-1',
                        title: 'Tuscan Leather Travel Holdall',
                        price: 18500,
                        quantity: 1,
                        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80'
                    }
                ],
                totalAmount: 18500
            },
            {
                id: 'ord_demo_2',
                orderNumber: 'AUR-58292',
                createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
                createdAtFormatted: 'Yesterday, 11:30 AM',
                status: 'shipped',
                adminRole: 'admin2',
                adminName: 'Elena Vance (Admin 2)',
                adminEmail: 'admin2@aurastudio.com',
                adminStoreName: 'Luxe Horizon Curation',
                clientUid: 'client-demo-2',
                clientName: 'Dinuka Senanayake',
                clientPhone: '+94 71 884 9201',
                clientEmail: 'dinuka@live.com',
                clientAddress: '72/A, Kandy Road',
                clientCity: 'Kiribathgoda',
                clientNotes: 'Call before delivery.',
                items: [
                    {
                        productId: 'prod-2',
                        title: 'Minimalist Obsidian Chronograph',
                        price: 24900,
                        quantity: 1,
                        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80'
                    }
                ],
                totalAmount: 24900
            }
        ];
    }

    function _bindOrderEvents() {
        // Events will be wired through index.html modals
    }

    return {
        init,
        onOrdersUpdated,
        processCheckout,
        getOrdersForCurrentAdmin,
        updateOrderStatus,
        renderAdminOrdersUI
    };

})();
