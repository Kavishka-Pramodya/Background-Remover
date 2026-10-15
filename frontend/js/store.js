/**
 * store.js — Multi-Admin E-Commerce Storefront, Catalog & Shopping Bag
 * 
 * Features:
 * - Seamless Unified Storefront: displays active products from BOTH Admin 1 and Admin 2
 * - Gated Shopping Experience: Unregistered/guest visitors can browse, but MUST sign in / register to add to cart & checkout
 * - Stock Inventory Tracking: shows real-time stock count; sold out items disable Add to Cart
 * - Temporary Product Deactivation: Admins can toggle products active/inactive (inactive products are hidden from storefront)
 * - Silent Multi-Vendor Routing: orders automatically routed to the respective publisher
 */

const StoreManager = (() => {

    const STORAGE_KEY = 'aura_store_products_v4';
    const CART_KEY = 'aura_store_cart_v2';

    // Curated initial products with Admin 1 & 2 attributions and Stock counts
    const DEFAULT_PRODUCTS = [
        {
            id: 'prod-1',
            title: 'Tuscan Leather Travel Holdall',
            category: 'bags',
            categoryLabel: 'Bags & Leather',
            price: 18500,
            originalPrice: 22000,
            rating: 4.9,
            reviewsCount: 38,
            badge: 'Artisan Edition',
            description: 'Handcrafted from vegetable-tanned full-grain Tuscan leather with antiqued brass hardware and reinforced saddle stitching.',
            image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80',
            phonePhoto: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80',
            template: 'Premium Light Studio',
            inStock: true,
            stockCount: 14,
            isActive: true,
            // Publisher Metadata (Admin 1)
            adminRole: 'admin1',
            adminName: 'Kavishka Pramodya (Admin 1)',
            adminStoreName: 'Aura Prime Atelier',
            adminEmail: 'kavishkapramodya2004@gmail.com',
            adminPhone: '+94 77 123 4567'
        },
        {
            id: 'prod-2',
            title: 'Minimalist Obsidian Chronograph',
            category: 'watches',
            categoryLabel: 'Watches & Tech',
            price: 24900,
            originalPrice: 28500,
            rating: 5.0,
            reviewsCount: 52,
            badge: 'Best Seller',
            description: 'Brushed surgical-grade 316L stainless steel casing, scratch-resistant sapphire crystal, and Japanese chronograph movement.',
            image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80',
            phonePhoto: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80',
            template: 'Soft Gray Studio',
            inStock: true,
            stockCount: 8,
            isActive: true,
            // Publisher Metadata (Admin 2)
            adminRole: 'admin2',
            adminName: 'Elena Vance (Admin 2)',
            adminStoreName: 'Luxe Horizon Curation',
            adminEmail: 'admin2@aurastudio.com',
            adminPhone: '+94 71 987 6543'
        },
        {
            id: 'prod-3',
            title: 'Oud & Santal Artisan Eau de Parfum',
            category: 'fragrances',
            categoryLabel: 'Fragrances',
            price: 12800,
            originalPrice: 15000,
            rating: 4.8,
            reviewsCount: 29,
            badge: 'Signature Scent',
            description: 'Artisanal small-batch formulation featuring wild Cambodian agarwood, velvety Mysore sandalwood, and sun-drenched bergamot.',
            image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=700&q=80',
            phonePhoto: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=700&q=80',
            template: 'Warm Neutral Studio',
            inStock: true,
            stockCount: 20,
            isActive: true,
            // Publisher Metadata (Admin 1)
            adminRole: 'admin1',
            adminName: 'Kavishka Pramodya (Admin 1)',
            adminStoreName: 'Aura Prime Atelier',
            adminEmail: 'kavishkapramodya2004@gmail.com',
            adminPhone: '+94 77 123 4567'
        },
        {
            id: 'prod-4',
            title: 'Apex Engineered Cloud Sneakers',
            category: 'footwear',
            categoryLabel: 'Footwear',
            price: 15400,
            originalPrice: 18000,
            rating: 4.9,
            reviewsCount: 64,
            badge: 'New Arrival',
            description: 'Featherweight technical woven upper with dual-density nitrogen-infused midsole for effortless all-day performance.',
            image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80',
            phonePhoto: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80',
            template: 'Premium Light Studio',
            inStock: true,
            stockCount: 6,
            isActive: true,
            // Publisher Metadata (Admin 2)
            adminRole: 'admin2',
            adminName: 'Elena Vance (Admin 2)',
            adminStoreName: 'Luxe Horizon Curation',
            adminEmail: 'admin2@aurastudio.com',
            adminPhone: '+94 71 987 6543'
        }
    ];

    let _products = [];
    let _cart = [];
    let _currentCategory = 'all';
    let _searchQuery = '';

    function init() {
        _loadProducts();
        _loadCart();
        _bindEvents();
        renderProducts();
        renderCartUI();
    }

    function _loadProducts() {
        // 1. Try Firestore if Live
        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                db.collection('products').onSnapshot(snap => {
                    if (!snap.empty) {
                        const fbProducts = [];
                        snap.forEach(doc => {
                            fbProducts.push({ id: doc.id, ...doc.data() });
                        });
                        _products = fbProducts;
                        _saveProductsLocal();
                        renderProducts();
                        if (typeof AdminManager !== 'undefined') AdminManager.renderCatalogTable();
                    }
                }, err => {
                    console.warn('Firestore products listener error, falling back to local:', err);
                });
            } catch (e) {
                console.warn('Firebase products load error:', e);
            }
        }

        // 2. Local Storage
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                _products = JSON.parse(saved);
            } else {
                _products = [...DEFAULT_PRODUCTS];
                _saveProductsLocal();
            }
        } catch {
            _products = [...DEFAULT_PRODUCTS];
        }
    }

    function _saveProductsLocal() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_products));
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
    }

    function _loadCart() {
        try {
            const saved = localStorage.getItem(CART_KEY);
            _cart = saved ? JSON.parse(saved) : [];
        } catch {
            _cart = [];
        }
    }

    function _saveCart() {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(_cart));
        } catch (e) {
            console.warn('Could not save cart to localStorage:', e);
        }
    }

    function _bindEvents() {
        // Search bar
        const searchInput = Utils.$('storeSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                _searchQuery = e.target.value.toLowerCase().trim();
                renderProducts();
            });
        }

        // Category pills
        const filterPills = document.querySelectorAll('.cat-pill');
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                _currentCategory = pill.dataset.category || 'all';
                renderProducts();
            });
        });

        // Cart toggle button
        const btnOpenCart = Utils.$('btnOpenCart');
        const btnCloseCart = Utils.$('btnCloseCart');
        const cartOverlay = Utils.$('cartOverlay');

        if (btnOpenCart) btnOpenCart.addEventListener('click', openCart);
        if (btnCloseCart) btnCloseCart.addEventListener('click', closeCart);
        if (cartOverlay) {
            cartOverlay.addEventListener('click', (e) => {
                if (e.target === cartOverlay) closeCart();
            });
        }

        // Checkout button — opens the full Checkout Dialog
        const btnCheckout = Utils.$('btnCheckout');
        if (btnCheckout) {
            btnCheckout.addEventListener('click', () => {
                const user = AuthManager.getCurrentUser();
                if (!user || user.role === 'guest' || !user.email) {
                    Utils.showToast('Please sign in or register to checkout your order.', 'info', 3500);
                    closeCart();
                    AuthManager.openAuthModal('signin');
                    return;
                }

                if (_cart.length === 0) {
                    Utils.showToast('Your cart is empty', 'info');
                    return;
                }
                closeCart();
                openCheckoutModal();
            });
        }
    }

    function getProducts() {
        return _products;
    }

    function getCart() {
        return _cart;
    }

    function clearCart() {
        _cart = [];
        _saveCart();
        renderCartUI();
    }

    /**
     * Store owner publishes product
     */
    async function addProduct(productData) {
        const currentUser = AuthManager.getCurrentUser();
        const isAdmin2 = currentUser.role === 'admin2';

        const adminRole = isAdmin2 ? 'admin2' : 'admin1';
        const adminName = currentUser.displayName || (isAdmin2 ? 'Elena Vance (Admin 2)' : 'Kavishka Pramodya (Admin 1)');
        const adminStoreName = currentUser.storeName || (isAdmin2 ? 'Luxe Horizon Curation' : 'Aura Prime Atelier');
        const adminEmail = currentUser.email || (isAdmin2 ? AuthManager.DEFAULT_ADMIN_2.email : AuthManager.DEFAULT_ADMIN_1.email);
        const adminPhone = currentUser.phone || (isAdmin2 ? '+94 71 987 6543' : '+94 77 123 4567');

        const newId = 'prod-' + Date.now();
        const stockCount = Number(productData.stockCount) || 10;

        const newProduct = {
            id: newId,
            title: productData.title || 'Untitled Luxury Item',
            category: productData.category || 'general',
            categoryLabel: productData.categoryLabel || 'Product',
            price: Number(productData.price) || 5000,
            originalPrice: productData.originalPrice ? Number(productData.originalPrice) : Math.round(Number(productData.price) * 1.25),
            rating: 5.0,
            reviewsCount: 1,
            badge: productData.badge || 'New Arrival',
            description: productData.description || `Handcrafted piece curated with calibrated studio light.`,
            image: productData.image,
            phonePhoto: productData.phonePhoto || null,
            template: productData.template || 'Studio Light Preset',
            inStock: stockCount > 0,
            stockCount: stockCount,
            isActive: true, // Active by default
            createdAt: Date.now(),
            
            // Publisher details:
            adminRole: adminRole,
            adminName: adminName,
            adminStoreName: adminStoreName,
            adminEmail: adminEmail,
            adminPhone: adminPhone
        };

        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                await db.collection('products').doc(newId).set(newProduct);
            } catch (fbErr) {
                console.warn('Firestore add product error:', fbErr);
            }
        }

        _products.unshift(newProduct);
        _saveProductsLocal();
        renderProducts();
        return newProduct;
    }

    async function deleteProduct(productId) {
        const currentUser = AuthManager.getCurrentUser();
        const prod = _products.find(p => p.id === productId);

        if (prod && currentUser.role === 'admin2' && prod.adminRole === 'admin1') {
            Utils.showToast('You can only delete products published by your own store.', 'error');
            return;
        }

        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                await db.collection('products').doc(productId).delete();
            } catch (e) {
                console.warn('Firestore delete product error:', e);
            }
        }

        _products = _products.filter(p => p.id !== productId);
        _saveProductsLocal();
        renderProducts();
        Utils.showToast('Product removed from catalog', 'info');
    }

    /**
     * Stock Management & Product Deactivation (Admin features)
     */
    async function toggleProductActive(productId) {
        const prod = _products.find(p => p.id === productId);
        if (!prod) return;

        prod.isActive = !prod.isActive;

        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                await db.collection('products').doc(productId).update({ isActive: prod.isActive });
            } catch (e) {
                console.warn(e);
            }
        }

        _saveProductsLocal();
        renderProducts();
        if (typeof AdminManager !== 'undefined') AdminManager.renderCatalogTable();
        
        const statusText = prod.isActive ? 'Active & Live on storefront' : 'Deactivated & Hidden from storefront';
        Utils.showToast(`"${prod.title}" is now ${statusText}.`, prod.isActive ? 'success' : 'warning');
    }

    async function updateProductStock(productId, newCount) {
        const prod = _products.find(p => p.id === productId);
        if (!prod) return;

        const count = Math.max(0, parseInt(newCount, 10) || 0);
        prod.stockCount = count;
        prod.inStock = count > 0;

        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                await db.collection('products').doc(productId).update({
                    stockCount: prod.stockCount,
                    inStock: prod.inStock
                });
            } catch (e) {
                console.warn(e);
            }
        }

        _saveProductsLocal();
        renderProducts();
        if (typeof AdminManager !== 'undefined') AdminManager.renderCatalogTable();
        Utils.showToast(`Stock updated to ${prod.stockCount} units.`, 'info');
    }

    async function updateProductDetails(productId, updates) {
        const prod = _products.find(p => p.id === productId);
        if (!prod) return;

        Object.assign(prod, updates);
        if (updates.stockCount !== undefined) {
            prod.inStock = prod.stockCount > 0;
        }

        if (FirebaseConfig.isLive() && FirebaseConfig.getFirestore()) {
            try {
                const db = FirebaseConfig.getFirestore();
                await db.collection('products').doc(productId).update(updates);
            } catch (e) {
                console.warn(e);
            }
        }

        _saveProductsLocal();
        renderProducts();
        if (typeof AdminManager !== 'undefined') AdminManager.renderCatalogTable();
        Utils.showToast('Product updated successfully.', 'success');
    }

    /**
     * Render Storefront Products:
     * - Inactive products are completely hidden from customer view!
     * - Out of stock products show "Sold Out" and disabled button
     */
    function renderProducts() {
        const grid = Utils.$('storeProductGrid');
        const countEl = Utils.$('storeProductCount');
        if (!grid) return;

        // Hide inactive/deactivated products from customer storefront!
        let filtered = _products.filter(p => p.isActive !== false);

        // Category filter
        if (_currentCategory !== 'all') {
            filtered = filtered.filter(p => p.category === _currentCategory);
        }

        // Search query
        if (_searchQuery) {
            filtered = filtered.filter(p => 
                p.title.toLowerCase().includes(_searchQuery) || 
                p.description.toLowerCase().includes(_searchQuery) ||
                (p.categoryLabel && p.categoryLabel.toLowerCase().includes(_searchQuery))
            );
        }

        if (countEl) {
            countEl.textContent = `${filtered.length} products`;
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-catalog-state">
                    <div class="empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <h3>No products available</h3>
                    <p>All items in this category are currently being curated or out of stock.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(product => {
            const isOutOfStock = (product.stockCount !== undefined && product.stockCount <= 0);
            
            const badgeHtml = isOutOfStock
                ? `<span class="store-card__badge" style="background:#ef4444; color:#fff;">Sold Out</span>`
                : (product.stockCount && product.stockCount <= 4
                    ? `<span class="store-card__badge" style="background:#f59e0b; color:#fff;">Only ${product.stockCount} Left</span>`
                    : (product.badge ? `<span class="store-card__badge">${Utils.escapeHtml(product.badge)}</span>` : ''));

            const buttonHtml = isOutOfStock
                ? `<button class="btn-add-cart btn-add-cart--soldout" type="button" disabled>Sold Out</button>`
                : `<button class="btn-add-cart" type="button" onclick="StoreManager.addToCart('${product.id}')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Add to Cart
                   </button>`;

            return `
                <article class="store-card ${isOutOfStock ? 'store-card--soldout' : ''}" data-id="${product.id}">
                    <div class="store-card__img-wrap">
                        <img src="${product.image}" alt="${Utils.escapeHtml(product.title)}" class="store-card__img" loading="lazy">
                        ${badgeHtml}
                        <button class="store-card__quickview" type="button" onclick="StoreManager.openProductQuickView('${product.id}')" title="Quick View">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            View Details
                        </button>
                    </div>
                    <div class="store-card__body">
                        <div class="store-card__category">${Utils.escapeHtml(product.categoryLabel || 'General')}</div>
                        <h3 class="store-card__title">${Utils.escapeHtml(product.title)}</h3>
                        
                        <div class="store-card__meta">
                            <div class="store-card__rating">
                                <span class="star-icon">★</span>
                                <span>${product.rating ? product.rating.toFixed(1) : '5.0'}</span>
                                <span class="reviews-count">(${product.reviewsCount || 1})</span>
                            </div>
                            <span class="store-stock-indicator ${isOutOfStock ? 'text-danger' : 'text-success'}">
                                ${isOutOfStock ? 'Out of Stock' : `In Stock (${product.stockCount || 10})`}
                            </span>
                        </div>

                        <div class="store-card__footer">
                            <div class="store-card__price-box">
                                <span class="store-card__price">Rs. ${product.price.toLocaleString()}</span>
                                ${product.originalPrice ? `<span class="store-card__price-orig">Rs. ${product.originalPrice.toLocaleString()}</span>` : ''}
                            </div>
                            ${buttonHtml}
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    /**
     * Add to Cart with Auth Protection & Stock Check
     */
    function addToCart(productId) {
        // REQUIREMENT: Unregistered / Guest user CANNOT add to cart or checkout. Must sign in / register!
        const user = AuthManager.getCurrentUser();
        if (!user || user.role === 'guest' || !user.email) {
            AuthManager.setPendingCartItem(productId);
            Utils.showToast('Please Sign In or Create an Account to start shopping.', 'info', 4000);
            AuthManager.openAuthModal('signup');
            return;
        }

        const product = _products.find(p => p.id === productId);
        if (!product) return;

        if (product.isActive === false) {
            Utils.showToast('This item is currently unavailable.', 'error');
            return;
        }

        if (product.stockCount !== undefined && product.stockCount <= 0) {
            Utils.showToast('Sorry, this product is sold out!', 'error');
            return;
        }

        const existing = _cart.find(item => item.productId === productId);
        if (existing) {
            if (product.stockCount !== undefined && existing.quantity >= product.stockCount) {
                Utils.showToast(`Maximum available stock reached (${product.stockCount} units).`, 'warning');
                return;
            }
            existing.quantity += 1;
        } else {
            _cart.push({
                productId: product.id,
                title: product.title,
                price: product.price,
                image: product.image,
                quantity: 1,
                product: { ...product }
            });
        }

        _saveCart();
        renderCartUI();
        Utils.showToast(`Added "${product.title}" to Bag!`, 'success');

        const badge = Utils.$('cartBadge');
        if (badge) {
            badge.classList.remove('pulse');
            void badge.offsetWidth;
            badge.classList.add('pulse');
        }
    }

    function updateCartQty(productId, delta) {
        const item = _cart.find(i => i.productId === productId);
        if (!item) return;

        const product = _products.find(p => p.id === productId);

        if (delta > 0 && product && product.stockCount !== undefined && item.quantity >= product.stockCount) {
            Utils.showToast(`Only ${product.stockCount} units available in stock.`, 'warning');
            return;
        }

        item.quantity += delta;
        if (item.quantity <= 0) {
            _cart = _cart.filter(i => i.productId !== productId);
        }

        _saveCart();
        renderCartUI();
    }

    function removeCartItem(productId) {
        _cart = _cart.filter(i => i.productId !== productId);
        _saveCart();
        renderCartUI();
    }

    function renderCartUI() {
        const badge = Utils.$('cartBadge');
        const countText = Utils.$('cartItemsCount');
        const listEl = Utils.$('cartItemList');
        const subtotalEl = Utils.$('cartSubtotal');

        const totalItems = _cart.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = _cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (badge) badge.textContent = totalItems;
        if (countText) countText.textContent = `${totalItems} items`;
        if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toLocaleString()}`;

        if (!listEl) return;

        if (_cart.length === 0) {
            listEl.innerHTML = `
                <div class="cart-empty">
                    <div class="cart-empty-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    </div>
                    <p>Your shopping bag is currently empty.</p>
                    <button class="btn btn--outline btn--sm" onclick="StoreManager.closeCart()">Continue Browsing</button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = _cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${Utils.escapeHtml(item.title)}" class="cart-item__img">
                <div class="cart-item__details">
                    <h4 class="cart-item__title">${Utils.escapeHtml(item.title)}</h4>
                    <div class="cart-item__price">Rs. ${(item.price * item.quantity).toLocaleString()}</div>
                    <div class="cart-item__qty-row">
                        <div class="cart-item__qty-ctrl">
                            <button class="qty-btn" onclick="StoreManager.updateCartQty('${item.productId}', -1)">-</button>
                            <span class="qty-val">${item.quantity}</span>
                            <button class="qty-btn" onclick="StoreManager.updateCartQty('${item.productId}', 1)">+</button>
                        </div>
                        <button class="cart-item__remove" onclick="StoreManager.removeCartItem('${item.productId}')">Remove</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function openCart() {
        const overlay = Utils.$('cartOverlay');
        const drawer = Utils.$('cartDrawer');
        if (overlay) Utils.show(overlay);
        if (drawer) drawer.classList.add('active');
    }

    function closeCart() {
        const overlay = Utils.$('cartOverlay');
        const drawer = Utils.$('cartDrawer');
        if (drawer) drawer.classList.remove('active');
        if (overlay) Utils.hide(overlay);
    }

    function openProductQuickView(productId) {
        const product = _products.find(p => p.id === productId);
        if (!product) return;

        const modal = Utils.$('productModal');
        const modalBody = Utils.$('productModalContent');
        if (!modal || !modalBody) return;

        const isOutOfStock = (product.stockCount !== undefined && product.stockCount <= 0);

        modalBody.innerHTML = `
            <div class="quickview-layout">
                <div class="quickview-gallery">
                    <img id="qvMainImage" src="${product.image}" alt="${Utils.escapeHtml(product.title)}" class="quickview-img">
                    ${product.phonePhoto ? `
                        <div class="qv-photo-toggle">
                            <span class="qv-toggle-label">Photography View:</span>
                            <div class="qv-toggle-buttons">
                                <button class="btn btn--xs btn--primary" id="btnShowStudioCard" onclick="document.getElementById('qvMainImage').src='${product.image}'">Studio Presentation</button>
                                <button class="btn btn--xs btn--outline" id="btnShowPhonePhoto" onclick="document.getElementById('qvMainImage').src='${product.phonePhoto}'">Original Capture</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="quickview-info">
                    <div style="margin-bottom: 0.5rem;">
                        <span class="quickview-cat">${Utils.escapeHtml(product.categoryLabel || 'General')}</span>
                    </div>
                    <h2 class="quickview-title">${Utils.escapeHtml(product.title)}</h2>
                    <div class="quickview-rating">★ ${product.rating ? product.rating.toFixed(1) : '5.0'} (${product.reviewsCount || 1} customer reviews)</div>
                    <div class="quickview-price-box">
                        <span class="quickview-price">Rs. ${product.price.toLocaleString()}</span>
                        ${product.originalPrice ? `<span class="quickview-price-orig">Rs. ${product.originalPrice.toLocaleString()}</span>` : ''}
                    </div>
                    <p class="quickview-desc">${Utils.escapeHtml(product.description)}</p>
                    <div class="quickview-meta-box">
                        <div><strong>Studio Preset:</strong> ${Utils.escapeHtml(product.template || 'Studio Light')}</div>
                        <div><strong>Stock Availability:</strong> <span class="stock-badge ${isOutOfStock ? 'badge--danger' : ''}">${isOutOfStock ? 'Sold Out' : `${product.stockCount || 10} Units in Stock`}</span></div>
                    </div>
                    <div class="quickview-actions">
                        ${isOutOfStock 
                            ? `<button class="btn btn--secondary btn--lg btn--full" disabled>Sold Out</button>`
                            : `<button class="btn btn--primary btn--lg btn--full" onclick="StoreManager.addToCart('${product.id}'); StoreManager.closeProductQuickView();">Add to Cart</button>`
                        }
                    </div>
                </div>
            </div>
        `;

        Utils.show(modal);
    }

    function closeProductQuickView() {
        Utils.hide(Utils.$('productModal'));
    }

    /**
     * Open Checkout modal — prefill registered client's details
     */
    function openCheckoutModal() {
        const modal = Utils.$('checkoutModal');
        if (!modal) return;

        const summaryBox = Utils.$('checkoutCartSummary');
        const totalEl = Utils.$('checkoutGrandTotal');
        const user = AuthManager.getCurrentUser();

        // Pre-fill user data
        const nameInput = Utils.$('checkoutCustomerName');
        const phoneInput = Utils.$('checkoutCustomerPhone');
        const emailInput = Utils.$('checkoutCustomerEmail');
        const addressInput = Utils.$('checkoutCustomerAddress');

        if (nameInput && user && user.displayName) nameInput.value = user.displayName;
        if (phoneInput && user && user.phone) phoneInput.value = user.phone;
        if (emailInput && user && user.email) emailInput.value = user.email;
        if (addressInput && user && user.address) addressInput.value = user.address;

        const groups = {};
        let grandTotal = 0;

        _cart.forEach(item => {
            const adminKey = (item.product && item.product.adminRole) || 'admin1';
            const adminStore = (item.product && item.product.adminStoreName) || (adminKey === 'admin2' ? 'Luxe Horizon Curation' : 'Aura Prime Atelier');

            if (!groups[adminKey]) {
                groups[adminKey] = {
                    adminRole: adminKey,
                    storeName: adminStore,
                    items: [],
                    subtotal: 0
                };
            }
            groups[adminKey].items.push(item);
            const lineTotal = item.price * item.quantity;
            groups[adminKey].subtotal += lineTotal;
            grandTotal += lineTotal;
        });

        if (summaryBox) {
            summaryBox.innerHTML = Object.keys(groups).map(key => {
                const grp = groups[key];
                return `
                    <div class="checkout-merchant-group">
                        <div class="checkout-merchant-header">
                            <span class="checkout-merchant-name">Order Package</span>
                            <span style="font-size: 11px; color: #71717a;">Direct Dispatch</span>
                        </div>
                        <div class="checkout-merchant-items">
                            ${grp.items.map(it => `
                                <div class="checkout-item-line">
                                    <span class="checkout-item-qty">${it.quantity}x</span>
                                    <span class="checkout-item-name">${Utils.escapeHtml(it.title)}</span>
                                    <span class="checkout-item-price">Rs. ${(it.price * it.quantity).toLocaleString()}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="checkout-group-subtotal">
                            <span>Package Subtotal:</span>
                            <strong>Rs. ${grp.subtotal.toLocaleString()}</strong>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (totalEl) totalEl.textContent = `Rs. ${grandTotal.toLocaleString()}`;

        Utils.show(modal);
    }

    function closeCheckoutModal() {
        Utils.hide(Utils.$('checkoutModal'));
    }

    return {
        init,
        getProducts,
        getCart,
        addProduct,
        deleteProduct,
        toggleProductActive,
        updateProductStock,
        updateProductDetails,
        renderProducts,
        addToCart,
        updateCartQty,
        removeCartItem,
        clearCart,
        openCart,
        closeCart,
        openProductQuickView,
        closeProductQuickView,
        openCheckoutModal,
        closeCheckoutModal
    };
})();
