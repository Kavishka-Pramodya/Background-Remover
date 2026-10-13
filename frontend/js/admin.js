/**
 * admin.js — Store Owner Admin & AI Studio Controller
 * 
 * Manages local AI engine connectivity detection, 1-click companion downloads,
 * product details form, live card preview, and one-click publishing to the storefront.
 */
const AdminManager = (() => {

    let _localEngineConnected = false;
    let _healthCheckInterval = null;
    let _lastProcessedImageDataUrl = null;
    let _rawPhonePhotoUrl = null;

    function init() {
        _bindAdminEvents();
        _startLocalHealthCheck();
        renderCatalogTable();
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

        if (inputTitle) {
            inputTitle.addEventListener('input', _updateLiveCardPreview);
        }
        if (inputPrice) {
            inputPrice.addEventListener('input', _updateLiveCardPreview);
        }
        if (selectCat) {
            selectCat.addEventListener('change', _updateLiveCardPreview);
        }

        // Publish to Store button
        const btnPublishProduct = Utils.$('btnPublishProduct');
        if (btnPublishProduct) {
            btnPublishProduct.addEventListener('click', onPublishProduct);
        }

        // Tab switching within admin (Creator vs Catalog List)
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
            });
        });
    }

    /**
     * Poll http://127.0.0.1:8000/api/health to auto-detect store owner's local backend.
     */
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
                const data = await res.json();
                if (!_localEngineConnected) {
                    _localEngineConnected = true;
                    if (badge) {
                        badge.className = 'engine-badge engine-badge--online';
                        badge.innerHTML = '<span class="status-dot"></span> Local AI Engine Active';
                    }
                    if (text) {
                        text.textContent = 'Connected (http://127.0.0.1:8000) — Zero Cloud Fees, 100% Free Unlimited Processing on your PC!';
                    }
                    if (hint) {
                        hint.innerHTML = '⚡ <strong>Running locally on your machine:</strong> Fast, private, and unlimited.';
                    }
                    Utils.showToast('Local AI Engine Connected! Ready for studio creations.', 'success', 2500);
                }
                return true;
            }
        } catch {
            // Local engine is offline
            if (_localEngineConnected) {
                Utils.showToast('Local AI engine disconnected.', 'info');
            }
            _localEngineConnected = false;
            if (badge) {
                badge.className = 'engine-badge engine-badge--offline';
                badge.innerHTML = '<span class="status-dot"></span> Local Engine Offline';
            }
            if (text) {
                text.textContent = 'Not detected on port 8000. Run the 1-click helper on your computer to process locally.';
            }
            if (hint) {
                hint.innerHTML = '💡 <strong>Store Owner Tip:</strong> Click <em>"Download 1-Click Engine"</em> below to run the AI on your PC without paying for cloud servers.';
            }
        }
        return false;
    }

    function isLocalEngineActive() {
        return _localEngineConnected;
    }

    /**
     * Downloads the complete Local AI Studio bundle (.zip).
     */
    function downloadLocalEngineScript() {
        window.open('https://github.com/Kavishka-Pramodya/Background-Remover/archive/refs/heads/main.zip', '_blank');
        Utils.showToast('Downloading Aura Local AI package! Extract & run start_local_studio.bat', 'success', 5000);
    }

    /**
     * Called when an image has been processed by the studio.
     */
    function setProcessedImage(dataUrlOrUrl, phonePhotoUrl = null) {
        _lastProcessedImageDataUrl = dataUrlOrUrl;
        if (phonePhotoUrl) {
            _rawPhonePhotoUrl = phonePhotoUrl;
        }

        const previewImg = Utils.$('livePreviewCardImg');
        if (previewImg) {
            previewImg.src = dataUrlOrUrl;
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
    function onPublishProduct() {
        const titleInput = Utils.$('adminProdTitle');
        const priceInput = Utils.$('adminProdPrice');
        const catSelect = Utils.$('adminProdCategory');
        const descInput = Utils.$('adminProdDesc');

        const title = titleInput ? titleInput.value.trim() : '';
        const price = priceInput ? Number(priceInput.value) : 0;
        const category = catSelect ? catSelect.value : 'general';
        const categoryLabel = catSelect && catSelect.selectedIndex >= 0 ? catSelect.options[catSelect.selectedIndex].text : 'General';
        const description = descInput ? descInput.value.trim() : '';

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

        // Get processed result image
        const resultImg = Utils.$('resultImage');
        const imageSrc = _lastProcessedImageDataUrl || (resultImg ? resultImg.src : null);

        if (!imageSrc) {
            Utils.showToast('Please create or process a studio image first before publishing.', 'error');
            return;
        }

        const selectedTemplate = TemplateManager.getSelectedTemplate();
        const templateName = selectedTemplate ? selectedTemplate.name : 'Studio Preset';

        const newProduct = StoreManager.addProduct({
            title: title,
            category: category,
            categoryLabel: categoryLabel,
            price: price,
            originalPrice: Math.round(price * 1.25),
            description: description || `Professional e-commerce product photograph created with Aura AI Studio using ${templateName}.`,
            image: imageSrc,
            phonePhoto: _rawPhonePhotoUrl || null,
            template: templateName
        });

        Utils.showToast(`🎉 Published "${newProduct.title}" to your E-Commerce Storefront!`, 'success', 3500);

        // Reset form inputs for next product
        if (titleInput) titleInput.value = '';
        if (priceInput) priceInput.value = '';
        if (descInput) descInput.value = '';

        renderCatalogTable();

        // Switch to Storefront so the store owner immediately sees the live card!
        if (window.App && window.App.showScreen) {
            setTimeout(() => {
                window.App.showScreen('storefront');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 600);
        }
    }

    function renderCatalogTable() {
        const tbody = Utils.$('catalogTableBody');
        const statTotal = Utils.$('adminStatTotalProducts');
        const products = StoreManager.getProducts();

        if (statTotal) {
            statTotal.textContent = products.length;
        }

        if (!tbody) return;

        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-6 text-gray-500">No products in your catalog yet. Create your first product above!</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map((p, idx) => `
            <tr>
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
                <td><span class="badge-pill badge-pill--studio">${Utils.escapeHtml(p.template || 'Studio AI')}</span></td>
                <td><span class="badge-pill badge-pill--stock">Active</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-action btn-action--view" onclick="StoreManager.openProductQuickView('${p.id}')" title="View Card">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="btn-action btn-action--delete" onclick="AdminManager.deleteProductConfirm('${p.id}')" title="Delete Product">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
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
        deleteProductConfirm
    };
})();
