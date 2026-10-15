/**
 * admin.js — Store Owner Admin, Inventory & Multi-Merchant Controller
 * 
 * Manages:
 * 1. AI Studio photo processing & lighting preset configuration
 * 2. Multi-merchant catalog management with Stock Counts & Active/Inactive Toggles
 * 3. Incoming customer orders & direct dispatch messaging
 * 4. User Management: Registered Customers List & Admin 2 Provisioning
 * 5. In-depth Product Edit & Stock Adjustments
 */

const AdminManager = (() => {

    let _localEngineConnected = false;
    let _healthCheckInterval = null;
    let _lastProcessedImageDataUrl = null;
    let _rawPhonePhotoUrl = null;
    let _editingProductId = null;

    function init() {
        _bindAdminEvents();
        _startLocalHealthCheck();
        renderCatalogTable();
        _renderAdmin2Details();
        renderRegisteredUsersTable();
    }

    function _bindAdminEvents() {
        // Download 1-click local engine helper
        const btnDownloadEngine = Utils.$('btnDownloadEngine');
        const btnDownloadEngineHero = Utils.$('btnDownloadEngineHero');
        if (btnDownloadEngine) {
            btnDownloadEngine.addEventListener('click', downloadLocalEngineScript);
        }
        if (btnDownloadEngineHero) {
            btnDownloadEngineHero.addEventListener('click', downloadLocalEngineScript);
        }

        // Live preview synchronization with form inputs
        const inputTitle = Utils.$('adminProdTitle');
        const inputPrice = Utils.$('adminProdPrice');
        const selectCat = Utils.$('adminProdCategory');

        if (inputTitle) inputTitle.addEventListener('input', _updateLiveCardPreview);
        if (inputPrice) inputPrice.addEventListener('input', _updateLiveCardPreview);
        if (selectCat) selectCat.addEventListener('change', _updateLiveCardPreview);

        // Publish to Store button
        const btnPublishProduct = Utils.$('btnPublishProduct');
        if (btnPublishProduct) {
            btnPublishProduct.addEventListener('click', onPublishProduct);
        }

        // Tab switching within admin
        const tabBtns = document.querySelectorAll('.admin-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.dataset.tab;
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                const content = Utils.$(`adminTab_${target}`);
                if (content) content.classList.add('active');

                if (target === 'catalog') renderCatalogTable();
                if (target === 'orders') {
                    if (typeof OrderManager !== 'undefined') OrderManager.renderAdminOrdersUI();
                }
                if (target === 'admin2' || target === 'users') {
                    _renderAdmin2Details();
                    renderRegisteredUsersTable();
                }
            });
        });

        // Register Admin 2 Form (Admin 1 only)
        const formAdmin2 = Utils.$('formRegisterAdmin2');
        if (formAdmin2) {
            formAdmin2.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const name = Utils.$('admin2RegName').value.trim();
                    const email = Utils.$('admin2RegEmail').value.trim();
                    const password = Utils.$('admin2RegPassword').value.trim();
                    const storeName = Utils.$('admin2RegStore').value.trim();

                    await AuthManager.createAdmin2({ name, email, password, storeName });
                    Utils.showToast(`Admin 2 (${email}) registered successfully!`, 'success');
                    _renderAdmin2Details();
                    formAdmin2.reset();
                } catch (err) {
                    Utils.showToast(err.message, 'error');
                }
            });
        }
    }

    function _renderAdmin2Details() {
        const statusBox = Utils.$('admin2CurrentStatus');
        if (!statusBox) return;

        const users = JSON.parse(localStorage.getItem('aura_local_registered_users_v2') || '{}');
        const admin2 = users['admin2@aurastudio.com'] || Object.values(users).find(u => u.role === 'admin2') || AuthManager.DEFAULT_ADMIN_2;

        statusBox.innerHTML = `
            <div class="admin2-info-card">
                <div class="admin2-badge">Verified Partner Merchant</div>
                <h4>${Utils.escapeHtml(admin2.displayName || 'Admin 2')}</h4>
                <div class="admin2-meta-row">
                    <span><strong>Email:</strong> ${Utils.escapeHtml(admin2.email)}</span>
                    <span><strong>Store Name:</strong> ${Utils.escapeHtml(admin2.storeName || 'Luxe Horizon Curation')}</span>
                    <span><strong>Role:</strong> Admin 2 (Partner Store)</span>
                </div>
                <div class="admin2-tip">
                    Admin 2 can sign in with this email to publish their products and manage their separate order dispatch.
                </div>
            </div>
        `;
    }

    /**
     * Render Registered Customers (User Management for Admin 1)
     */
    function renderRegisteredUsersTable() {
        const tbody = Utils.$('adminUsersTableBody');
        const countBadge = Utils.$('adminClientCountBadge');
        if (!tbody) return;

        const clients = AuthManager.getAllRegisteredClients();
        if (countBadge) countBadge.textContent = `${clients.length} Customers`;

        if (clients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-6 text-gray-500">
                        No registered customers yet. When clients register to shop, they will appear here.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = clients.map((c, idx) => {
            const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
            const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';

            return `
                <tr>
                    <td><strong>#${idx + 1}</strong></td>
                    <td>
                        <div>
                            <strong>${Utils.escapeHtml(c.displayName || 'Customer')}</strong>
                            <div style="font-size: 11px; color: #71717a;">${Utils.escapeHtml(c.email)}</div>
                        </div>
                    </td>
                    <td>
                        <span style="color: #2563eb; font-weight: 500;">${Utils.escapeHtml(c.phone || 'No phone')}</span>
                    </td>
                    <td>
                        <span style="font-size: 12px; color: #52525b;">${Utils.escapeHtml(c.address || 'Islandwide')}</span>
                    </td>
                    <td>
                        <div class="table-actions">
                            ${cleanPhone ? `
                                <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn--outline btn--xs" title="WhatsApp Customer">
                                    💬 WhatsApp
                                </a>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function _startLocalHealthCheck() {
        checkLocalHealth();
        _healthCheckInterval = setInterval(checkLocalHealth, 3500);
    }

    async function checkLocalHealth() {
        const badge = Utils.$('localEngineBadge');
        const text = Utils.$('localEngineText');
        const hint = Utils.$('localEngineHint');

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);

            const res = await fetch('http://127.0.0.1:8000/api/health', {
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (res.ok) {
                if (!_localEngineConnected) {
                    _localEngineConnected = true;
                    if (badge) {
                        badge.className = 'engine-badge engine-badge--online';
                        badge.innerHTML = '<span class="status-dot"></span> Studio Engine Online';
                    }
                    if (text) {
                        text.textContent = 'Hardware acceleration active on port 8000 — Unlimited native rendering at full resolution.';
                    }
                    if (hint) {
                        hint.innerHTML = '⚡ <strong>Hardware Engine Active:</strong> Background removal is running in pure local silicon with zero cloud costs.';
                    }
                }
                return true;
            }
        } catch {
            _localEngineConnected = false;
            if (badge) {
                badge.className = 'engine-badge engine-badge--offline';
                badge.innerHTML = '<span class="status-dot"></span> Offline Canvas Mode';
            }
            if (text) {
                text.textContent = 'Running in browser canvas mode. For native ultra-res studio segmentation, launch your local engine.';
            }
        }
        return false;
    }

    function isLocalEngineActive() {
        return _localEngineConnected;
    }

    function downloadLocalEngineScript() {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.toUpperCase().indexOf('MACINTOSH') >= 0;
        const link = document.createElement('a');
        link.href = isMac ? 'downloads/start_local_studio.command' : 'downloads/start_local_studio.bat';
        link.download = isMac ? 'start_local_studio.command' : 'start_local_studio.bat';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Utils.showToast('Launcher downloaded! Double-click to start local AI engine.', 'info', 4000);
    }

    function setProcessedImage(dataUrlOrUrl, rawPhonePhotoUrl) {
        _lastProcessedImageDataUrl = dataUrlOrUrl;
        if (rawPhonePhotoUrl) {
            _rawPhonePhotoUrl = rawPhonePhotoUrl;
        }

        const previewImg = Utils.$('livePreviewProductImg');
        if (previewImg && dataUrlOrUrl) {
            let finalUrl = dataUrlOrUrl;
            if (finalUrl && finalUrl.startsWith('/api/') && typeof ApiService !== 'undefined') {
                finalUrl = `${ApiService.getBaseURL()}${finalUrl}`;
            }
            previewImg.src = finalUrl;
        }

        const btnPublish = Utils.$('btnPublishProduct');
        if (btnPublish) {
            btnPublish.disabled = false;
        }

        _updateLiveCardPreview();
    }

    function _updateLiveCardPreview() {
        const titleInput = Utils.$('adminProdTitle');
        const priceInput = Utils.$('adminProdPrice');
        const catSelect = Utils.$('adminProdCategory');

        const cardTitle = Utils.$('livePreviewCardTitle');
        const cardPrice = Utils.$('livePreviewCardPrice');
        const cardCat = Utils.$('livePreviewCardCat');

        if (cardTitle && titleInput) {
            cardTitle.textContent = titleInput.value.trim() || 'Product Title';
        }
        if (cardPrice && priceInput) {
            const val = Number(priceInput.value) || 0;
            cardPrice.textContent = val > 0 ? `Rs. ${val.toLocaleString()}` : 'Rs. 0';
        }
        if (cardCat && catSelect) {
            const opt = catSelect.options[catSelect.selectedIndex];
            cardCat.textContent = opt ? opt.text : 'Category';
        }
    }

    /**
     * Store Owner clicks "Publish Product to Store"
     */
    async function onPublishProduct() {
        const titleInput = Utils.$('adminProdTitle');
        const priceInput = Utils.$('adminProdPrice');
        const catSelect = Utils.$('adminProdCategory');
        const descInput = Utils.$('adminProdDesc');
        const stockInput = Utils.$('adminProdStock');

        const title = titleInput ? titleInput.value.trim() : '';
        const price = priceInput ? Number(priceInput.value) : 0;
        const category = catSelect ? catSelect.value : 'general';
        const categoryLabel = catSelect && catSelect.selectedIndex >= 0 ? catSelect.options[catSelect.selectedIndex].text : 'General';
        const description = descInput ? descInput.value.trim() : '';
        const stockCount = stockInput ? (parseInt(stockInput.value, 10) || 10) : 10;

        if (!title) {
            Utils.showToast('Please enter a product title.', 'error');
            if (titleInput) titleInput.focus();
            return;
        }

        if (!price || price <= 0) {
            Utils.showToast('Please enter a valid price.', 'error');
            if (priceInput) priceInput.focus();
            return;
        }

        const resultImg = Utils.$('resultImage');
        let imageSrc = _lastProcessedImageDataUrl || (resultImg ? resultImg.src : null);

        if (!imageSrc) {
            Utils.showToast('Please create or process a studio image first before publishing.', 'error');
            return;
        }

        const selectedTemplate = TemplateManager.getSelectedTemplate();
        const templateName = selectedTemplate ? selectedTemplate.name : 'Studio Preset';

        const currentUser = AuthManager.getCurrentUser();

        // Optional: Upload to Firebase Storage if Live
        if (FirebaseConfig.isLive() && FirebaseConfig.getStorage() && imageSrc.startsWith('data:image')) {
            try {
                Utils.showToast('Uploading image to Firebase Cloud Storage...', 'info');
                const storageRef = FirebaseConfig.getStorage().ref();
                const imgRef = storageRef.child(`products/${Date.now()}_prod.png`);
                await imgRef.putString(imageSrc, 'data_url');
                imageSrc = await imgRef.getDownloadURL();
            } catch (storageErr) {
                console.warn('Firebase Storage upload failed, storing locally:', storageErr);
            }
        }

        const newProduct = await StoreManager.addProduct({
            title: title,
            category: category,
            categoryLabel: categoryLabel,
            price: price,
            originalPrice: Math.round(price * 1.25),
            stockCount: stockCount,
            description: description || `Artisanal product presentation with calibrated studio lighting (${templateName}).`,
            image: imageSrc,
            phonePhoto: _rawPhonePhotoUrl || null,
            template: templateName
        });

        Utils.showToast(`Published "${newProduct.title}" (Stock: ${stockCount}) to collection!`, 'success', 3500);

        if (titleInput) titleInput.value = '';
        if (priceInput) priceInput.value = '';
        if (descInput) descInput.value = '';
        if (stockInput) stockInput.value = '10';

        renderCatalogTable();

        if (window.App && window.App.showScreen) {
            setTimeout(() => {
                window.App.showScreen('storefront');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 600);
        }
    }

    /**
     * Render Catalog Table with Stock counts and Active/Inactive toggle
     */
    function renderCatalogTable() {
        const tbody = Utils.$('catalogTableBody');
        const statTotal = Utils.$('adminStatTotalProducts');
        const allProducts = StoreManager.getProducts();
        const currentUser = AuthManager.getCurrentUser();

        const isAdmin1 = currentUser.role === 'admin1';
        const isAdmin2 = currentUser.role === 'admin2';

        // Filter products for this specific admin
        let myProducts = allProducts;
        if (isAdmin1) {
            myProducts = allProducts.filter(p => (p.adminRole || 'admin1') === 'admin1');
        } else if (isAdmin2) {
            myProducts = allProducts.filter(p => p.adminRole === 'admin2');
        }

        if (statTotal) {
            statTotal.textContent = myProducts.length;
        }

        if (!tbody) return;

        if (myProducts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-6 text-gray-500">
                        No products in your store catalogue yet. Create your first product above!
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = myProducts.map((p, idx) => {
            const isActive = p.isActive !== false;
            const stock = p.stockCount !== undefined ? p.stockCount : 10;
            const isOutOfStock = stock <= 0;

            return `
                <tr class="${!isActive ? 'opacity-50' : ''}">
                    <td class="font-medium text-gray-400">#${idx + 1}</td>
                    <td>
                        <div class="table-prod-cell">
                            <img src="${p.image}" alt="${Utils.escapeHtml(p.title)}" class="table-prod-img">
                            <div>
                                <div class="table-prod-title">${Utils.escapeHtml(p.title)}</div>
                                <div class="table-prod-cat">${Utils.escapeHtml(p.categoryLabel || 'General')}</div>
                            </div>
                        </div>
                    </td>
                    <td class="font-semibold text-gray-900">Rs. ${p.price.toLocaleString()}</td>
                    
                    <!-- Stock Inventory Control -->
                    <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button class="btn btn--outline btn--xs" onclick="StoreManager.updateProductStock('${p.id}', ${Math.max(0, stock - 1)})" title="Decrease stock">-</button>
                            <span style="font-weight: 700; min-width: 28px; text-align: center; color: ${isOutOfStock ? '#ef4444' : '#18181b'};">
                                ${stock}
                            </span>
                            <button class="btn btn--outline btn--xs" onclick="StoreManager.updateProductStock('${p.id}', ${stock + 1})" title="Increase stock">+</button>
                            ${isOutOfStock ? '<span class="status-badge badge--danger" style="font-size: 10px;">Out of Stock</span>' : ''}
                        </div>
                    </td>

                    <!-- Live Status: Active (Live) vs Deactivated (Hidden) -->
                    <td>
                        <button class="btn-status-toggle ${isActive ? 'btn-status-toggle--active' : 'btn-status-toggle--inactive'}" 
                                onclick="StoreManager.toggleProductActive('${p.id}')" 
                                title="${isActive ? 'Click to temporarily deactivate product' : 'Click to activate product and show on store'}">
                            ${isActive ? '🟢 Active (Live)' : '⏸️ Deactivated'}
                        </button>
                    </td>

                    <td>
                        <div class="table-actions">
                            <button class="btn-action" onclick="AdminManager.openEditModal('${p.id}')" title="Edit Product & Stock">
                                ✏️
                            </button>
                            <button class="btn-action btn-action--view" onclick="StoreManager.openProductQuickView('${p.id}')" title="View Details">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button class="btn-action btn-action--delete" onclick="AdminManager.deleteProductConfirm('${p.id}')" title="Delete Product">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openEditModal(productId) {
        const prod = StoreManager.getProducts().find(p => p.id === productId);
        if (!prod) return;

        _editingProductId = productId;
        const modal = Utils.$('editProductModal');
        if (!modal) return;

        Utils.$('editProdTitle').value = prod.title || '';
        Utils.$('editProdPrice').value = prod.price || '';
        Utils.$('editProdStock').value = prod.stockCount !== undefined ? prod.stockCount : 10;
        Utils.$('editProdActive').checked = prod.isActive !== false;

        Utils.show(modal);
    }

    function closeEditModal() {
        _editingProductId = null;
        Utils.hide(Utils.$('editProductModal'));
    }

    async function saveEditedProduct() {
        if (!_editingProductId) return;

        const title = Utils.$('editProdTitle').value.trim();
        const price = Number(Utils.$('editProdPrice').value) || 0;
        const stockCount = parseInt(Utils.$('editProdStock').value, 10) || 0;
        const isActive = Utils.$('editProdActive').checked;

        if (!title || price <= 0) {
            Utils.showToast('Please provide a valid title and price.', 'error');
            return;
        }

        await StoreManager.updateProductDetails(_editingProductId, {
            title,
            price,
            stockCount,
            isActive
        });

        closeEditModal();
        renderCatalogTable();
    }

    function deleteProductConfirm(productId) {
        if (confirm('Are you sure you want to remove this product from your store?')) {
            StoreManager.deleteProduct(productId);
            renderCatalogTable();
        }
    }

    return {
        init,
        isLocalEngineActive,
        checkLocalHealth,
        downloadLocalEngineScript,
        setProcessedImage,
        onPublishProduct,
        renderCatalogTable,
        renderRegisteredUsersTable,
        openEditModal,
        closeEditModal,
        saveEditedProduct,
        deleteProductConfirm
    };
})();
