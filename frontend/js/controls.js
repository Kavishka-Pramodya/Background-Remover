/**
 * controls.js — Adjustment controls logic
 */
const ControlsManager = (() => {

    const CONTROLS = [
        { id: 'ctrlScale', key: 'scale', suffix: '%' },
        { id: 'ctrlPositionX', key: 'position_x', suffix: '%' },
        { id: 'ctrlPositionY', key: 'position_y', suffix: '%' },
        { id: 'ctrlShadowIntensity', key: 'shadow_intensity', suffix: '%' },
        { id: 'ctrlShadowSoftness', key: 'shadow_softness', suffix: '%' }
    ];

    let _onChange = null;

    function init(onChange) {
        _onChange = onChange;

        CONTROLS.forEach(ctrl => {
            const input = Utils.$(ctrl.id);
            if (!input) return;

            // Live update display value
            input.addEventListener('input', () => {
                _updateDisplay(ctrl);
                if (_onChange) {
                    _onChange(getValues());
                }
            });

            // Initial display
            _updateDisplay(ctrl);
        });
    }

    function _updateDisplay(ctrl) {
        const input = Utils.$(ctrl.id);
        const display = Utils.$(`${ctrl.id}Value`);
        if (input && display) {
            display.textContent = `${input.value}${ctrl.suffix}`;
        }
    }

    /**
     * Get all current control values as an object.
     */
    function getValues() {
        const values = {};
        CONTROLS.forEach(ctrl => {
            const input = Utils.$(ctrl.id);
            if (input) {
                values[ctrl.key] = parseInt(input.value, 10);
            }
        });
        return values;
    }

    /**
     * Set control values from a template's defaults or settings object.
     */
    function setValues(settings) {
        CONTROLS.forEach(ctrl => {
            if (settings[ctrl.key] != null) {
                const input = Utils.$(ctrl.id);
                if (input) {
                    input.value = settings[ctrl.key];
                    _updateDisplay(ctrl);
                }
            }
        });
    }

    /**
     * Reset all controls to defaults.
     */
    function resetToDefaults() {
        setValues({
            scale: 80,
            position_x: 50,
            position_y: 50,
            shadow_intensity: 40,
            shadow_softness: 30
        });
    }

    return {
        init,
        getValues,
        setValues,
        resetToDefaults
    };
})();
