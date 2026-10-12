/**
 * templates.js — Template selector logic
 * 
 * Fetches templates from backend API or uses fallback definitions
 * when backend is not available.
 */
const TemplateManager = (() => {

    // Fallback template definitions for when backend is unavailable
    const FALLBACK_TEMPLATES = [
        {
            id: 'premium_light',
            name: 'Premium Light',
            description: 'Clean white-to-light-gray gradient. Ideal for most products.',
            defaults: { scale: 80, position_x: 50, position_y: 50, shadow_intensity: 40, shadow_softness: 30 }
        },
        {
            id: 'soft_gray',
            name: 'Soft Gray',
            description: 'Warm light gray with gentle directional lighting.',
            defaults: { scale: 80, position_x: 50, position_y: 50, shadow_intensity: 35, shadow_softness: 35 }
        },
        {
            id: 'warm_neutral',
            name: 'Warm Neutral',
            description: 'Warm beige/cream tone with soft gradient.',
            defaults: { scale: 80, position_x: 50, position_y: 50, shadow_intensity: 30, shadow_softness: 40 }
        }
    ];

    let _templates = [];
    let _selectedId = null;
    let _onSelect = null;
    let _usesFallback = false;

    function init(onSelect) {
        _onSelect = onSelect;
        const retryBtn = Utils.$('btnRetryTemplates');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => loadTemplates());
        }
        loadTemplates();
    }

    async function loadTemplates() {
        const grid = Utils.$('templateGrid');
        const loading = Utils.$('templateLoading');
        const error = Utils.$('templateError');

        Utils.hide(error);
        Utils.show(loading);

        try {
            const data = await ApiService.getTemplates();
            _templates = data.templates || [];
            _usesFallback = false;
        } catch (err) {
            console.warn('Could not load templates from backend, using fallback:', err.message);
            _templates = FALLBACK_TEMPLATES;
            _usesFallback = true;
        }

        Utils.hide(loading);

        if (_templates.length === 0) {
            Utils.show(error);
            return;
        }

        _renderTemplates(grid);

        // Auto-select first template
        if (!_selectedId && _templates.length > 0) {
            selectTemplate(_templates[0].id, false); // initial select without triggering reprocess
        }
    }

    function _renderTemplates(grid) {
        grid.innerHTML = '';

        _templates.forEach(tpl => {
            const card = document.createElement('div');
            card.className = `template-card ${card.dataset.templateId === _selectedId ? 'selected' : ''}`;
            card.dataset.templateId = tpl.id;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `Select ${tpl.name} background`);
            card.title = tpl.description;

            // Fallback gradient element
            const preview = document.createElement('div');
            preview.className = `template-card__preview--generated tpl-preview--${tpl.id} tpl-preview--${tpl.id.replace(/_/g, '-')}`;

            // Try to load real high-res preview image from backend API
            const previewUrl = ApiService.getTemplatePreviewURL(tpl.id);
            const img = document.createElement('img');
            img.className = 'template-card__preview';
            img.src = previewUrl;
            img.alt = tpl.name;
            img.loading = 'lazy';
            img.onerror = () => {
                // If image fails, replace with CSS gradient box
                img.replaceWith(preview);
            };
            card.appendChild(img);

            const name = document.createElement('span');
            name.className = 'template-card__name';
            name.textContent = tpl.name;

            card.appendChild(name);

            // Click listener
            card.addEventListener('click', (e) => {
                e.preventDefault();
                selectTemplate(tpl.id, true);
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectTemplate(tpl.id, true);
                }
            });

            grid.appendChild(card);
        });
    }

    function selectTemplate(id, userInitiated = true) {
        _selectedId = id;

        // Update visual selection on cards
        const grid = Utils.$('templateGrid');
        if (grid) {
            grid.querySelectorAll('.template-card').forEach(card => {
                const isSelected = card.dataset.templateId === id;
                card.classList.toggle('selected', isSelected);
            });
        }

        // Find template and notify listener
        const tpl = _templates.find(t => t.id === id);
        if (tpl && _onSelect) {
            _onSelect(tpl, userInitiated);
        }
    }

    function getSelectedId() {
        return _selectedId;
    }

    function getSelectedTemplate() {
        return _templates.find(t => t.id === _selectedId) || null;
    }

    return {
        init,
        loadTemplates,
        selectTemplate,
        getSelectedId,
        getSelectedTemplate
    };
})();
