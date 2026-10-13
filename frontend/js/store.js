/**
 * store.js — E-Commerce Storefront & Catalog Manager
 * 
 * Handles catalog items, category filtering, search, shopping cart,
 * and persistent storage in localStorage.
 */
const StoreManager = (() => {

    const STORAGE_KEY = 'aura_store_products_v1';
    const CART_KEY = 'aura_store_cart_v1';

    // Initial pre-loaded luxury demo products
    const DEFAULT_PRODUCTS = [
        {
            id: 'prod-1',
            title: 'Luxe Italian Leather Briefcase',
            category: 'bags',
            categoryLabel: 'Bags & Leather',
            price: 18500,
            originalPrice: 22000,
            rating: 4.9,
            reviewsCount: 38,
            badge: 'Studio AI Created',
            description: 'Handcrafted full-grain leather briefcase with brass hardware. Photographed on a phone and enhanced with Aura Studio AI.',
            image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80',
            phonePhoto: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80',
            template: 'Premium Light Studio',
            inStock: true
        },
        {
            id: 'prod-2',
            title: 'Minimalist Chrono Obsidian Watch',
            category: 'watches',
            categoryLabel: 'Watches & Tech',
            price: 24900,
            originalPrice: 28500,
            rating: 5.0,
            reviewsCount: 52,
            badge: 'Studio AI Created',
            description: 'Matte black stainless steel chronometer with sapphire crystal glass and Japanese quartz movement.',
            image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80',
            phonePhoto: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80',
            template: 'Soft Gray Studio',
            inStock: true
        },
        {
            id: 'prod-3',
            title: 'Oud & Amber Artisan Eau de Parfum',
            category: 'fragrances',
            categoryLabel: 'Fragrances',
            price: 12800,
            originalPrice: 15000,
            rating: 4.8,
            reviewsCount: 29,
            badge: 'Studio AI Created',
            description: 'Rich oriental scent with notes of wild oud, warm amber, and smoky bergamot. Luxury 100ml flacon.',
            image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=700&q=80',
            phonePhoto: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=700&q=80',
            template: 'Warm Neutral Studio',
            inStock: true
        },
        {
            id: 'prod-4',
            title: 'Apex Cloudfoam Running Sneakers',
            category: 'footwear',
            categoryLabel: 'Footwear',
            price: 15400,
            originalPrice: 18000,
            rating: 4.9,
            reviewsCount: 64,
            badge: 'Studio AI Created',
            description: 'Ultra-light breathable mesh athletic sneakers with adaptive carbon-infused bounce cushioning.',
            image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80',
            phonePhoto: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80',
            template: 'Premium Light Studio',
            inStock: true
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
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                _products = JSON.parse(saved);
            } else {
                _products = [...DEFAULT_PRODUCTS];
                _saveProducts();
            }
        } catch {
            _products = [...DEFAULT_PRODUCTS];
        }
    }

    function _saveProducts() {
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

        if (btnOpenCart) {
            btnOpenCart.addEventListener('click', openCart);
        }
        if (btnCloseCart) {
            btnCloseCart.addEventListener('click', closeCart);
        }
        if (cartOverlay) {
            cartOverlay.addEventListener('click', (e) => {
                if (e.target === cartOverlay) closeCart();
            });
        }

        // Checkout button
        const btnCheckout = Utils.$('btnCheckout');
        if (btnCheckout) {
            btnCheckout.addEventListener('click', () => {
                if (_cart.length === 0) {
                    Utils.showToast('Your cart is empty', 'info');
                    return;
                }
                Utils.showToast('Demo Checkout: Thank you for shopping with Aura Store! Order placed.', 'success', 3000);
                _cart = [];
                _saveCart();
                renderCartUI();
                closeCart();
            });
        }
    }

    function getProducts() {
        return _products;
    }

    function addProduct(productData) {
        const newProduct = {
            id: 'prod-' + Date.now(),
            title: productData.title || 'Untitled Product',
            category: productData.category || 'general',
            categoryLabel: productData.categoryLabel || 'Product',
            price: Number(productData.price) || 5000,
            originalPrice: productData.originalPrice ? Number(productData.originalPrice) : Math.round(Number(productData.price) * 1.2),
            rating: 5.0,
            reviewsCount: 1,
            badge: '✨ Just Added with AI Studio',
            description: productData.description || 'Newly added product card created with Aura AI Studio.',
            image: productData.image,
            phonePhoto: productData.phonePhoto || null,
            template: productData.template || 'Studio Template',
            inStock: true,
            createdAt: Date.now()
        };

        // Add to beginning of array so store owner sees it at the top
        _products.unshift(newProduct);
        _saveProducts();
        renderProducts();
        return newProduct;
    }

    function deleteProduct(productId) {
        _products = _products.filter(p => p.id !== productId);
        _saveProducts();
        renderProducts();
        Utils.showToast('Product removed from catalog', 'info');
    }

    function renderProducts() {
        const grid = Utils.$('storeProductGrid');
        const countEl = Utils.$('storeProductCount');
        if (!grid) return;

        let filtered = _products;

        if (_currentCategory !== 'all') {
            filtered = filtered.filter(p => p.category === _currentCategory);
        }

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
                    <div class="empty-icon">🛍️</div>
                    <h3>No products found</h3>
                    <p>Try searching with another keyword or add a new product in the Store Owner Portal.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(product => `
            <article class="store-card" data-id="${product.id}">
                <div class="store-card__img-wrap">
                    <img src="${product.image}" alt="${Utils.escapeHtml(product.title)}" class="store-card__img" loading="lazy">
                    ${product.badge ? `<span class="store-card__badge">${Utils.escapeHtml(product.badge)}</span>` : ''}
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
                            <span>${product.rating.toFixed(1)}</span>
                            <span class="reviews-count">(${product.reviewsCount})</span>
                        </div>
                    </div>

                    <div class="store-card__footer">
                        <div class="store-card__price-box">
                            <span class="store-card__price">Rs. ${product.price.toLocaleString()}</span>
                            ${product.originalPrice ? `<span class="store-card__price-orig">Rs. ${product.originalPrice.toLocaleString()}</span>` : ''}
                        </div>
                        <button class="btn-add-cart" type="button" onclick="StoreManager.addToCart('${product.id}')">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                            Add to Cart
                        </button>
                    </div>
                </div>
            </article>
        `).join('');
    }

    function addToCart(productId) {
        const product = _products.find(p => p.id === productId);
        if (!product) return;

        const existing = _cart.find(item => item.productId === productId);
        if (existing) {
            existing.quantity += 1;
        } else {
            _cart.push({
                productId: product.id,
                title: product.title,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }

        _saveCart();
        renderCartUI();
        Utils.showToast(`Added "${product.title}" to Cart!`, 'success');

        // Trigger micro-animation on cart badge
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
                    <div class="cart-empty-icon">🛒</div>
                    <p>Your shopping cart is empty.</p>
                    <button class="btn btn--outline btn--sm" onclick="StoreManager.closeCart()">Continue Shopping</button>
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

        modalBody.innerHTML = `
            <div class="quickview-layout">
                <div class="quickview-gallery">
                    <img id="qvMainImage" src="${product.image}" alt="${Utils.escapeHtml(product.title)}" class="quickview-img">
                    ${product.phonePhoto ? `
                        <div class="qv-photo-toggle">
                            <span class="qv-toggle-label">Compare Photography:</span>
                            <div class="qv-toggle-buttons">
                                <button class="btn btn--xs btn--primary" id="btnShowStudioCard" onclick="document.getElementById('qvMainImage').src='${product.image}'">✨ Studio Card</button>
                                <button class="btn btn--xs btn--outline" id="btnShowPhonePhoto" onclick="document.getElementById('qvMainImage').src='${product.phonePhoto}'">📱 Raw Phone Photo</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="quickview-info">
                    <span class="quickview-cat">${Utils.escapeHtml(product.categoryLabel || 'General')}</span>
                    <h2 class="quickview-title">${Utils.escapeHtml(product.title)}</h2>
                    <div class="quickview-rating">★ ${product.rating.toFixed(1)} (${product.reviewsCount} customer reviews)</div>
                    <div class="quickview-price-box">
                        <span class="quickview-price">Rs. ${product.price.toLocaleString()}</span>
                        ${product.originalPrice ? `<span class="quickview-price-orig">Rs. ${product.originalPrice.toLocaleString()}</span>` : ''}
                    </div>
                    <p class="quickview-desc">${Utils.escapeHtml(product.description)}</p>
                    <div class="quickview-meta-box">
                        <div><strong>Studio Preset:</strong> ${Utils.escapeHtml(product.template || 'Studio')}</div>
                        <div><strong>Availability:</strong> <span class="stock-badge">In Stock</span></div>
                    </div>
                    <div class="quickview-actions">
                        <button class="btn btn--primary btn--lg btn--full" onclick="StoreManager.addToCart('${product.id}'); StoreManager.closeProductQuickView();">
                            Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        `;

        Utils.show(modal);
    }

    function closeProductQuickView() {
        Utils.hide(Utils.$('productModal'));
    }

    return {
        init,
        getProducts,
        addProduct,
        deleteProduct,
        renderProducts,
        addToCart,
        updateCartQty,
        removeCartItem,
        openCart,
        closeCart,
        openProductQuickView,
        closeProductQuickView
    };
})();
