document.addEventListener('DOMContentLoaded', () => {
    const elementModeBtn = document.getElementById('elementModeBtn');
    const windowModeBtn = document.getElementById('windowModeBtn');
    const fullPageModeBtn = document.getElementById('fullPageModeBtn');
    const description = document.getElementById('modeDescription');

    // Retrieve and set initial state
    chrome.storage.sync.get('captureMode', (data) => {
        const mode = data.captureMode || 'elementCapture';
        updateModeButtons(mode);
        updateDescription(mode);
    });

    // Add click event listeners for mode buttons
    [elementModeBtn, windowModeBtn, fullPageModeBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            let mode;
            if (btn === elementModeBtn) mode = 'elementCapture';
            if (btn === windowModeBtn) mode = 'windowCapture';
            if (btn === fullPageModeBtn) mode = 'fullPageCapture';

            // Save mode to storage
            chrome.storage.sync.set({
                captureMode: mode
            });

            // Send message to content script
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleMode',
                    mode: mode
                });
            });

            // Update button states and description
            updateModeButtons(mode);
            updateDescription(mode);
        });
    });

    function updateModeButtons(mode) {
        elementModeBtn.classList.remove('active');
        windowModeBtn.classList.remove('active');
        fullPageModeBtn.classList.remove('active');

        if (mode === 'elementCapture') elementModeBtn.classList.add('active');
        if (mode === 'windowCapture') windowModeBtn.classList.add('active');
        if (mode === 'fullPageCapture') fullPageModeBtn.classList.add('active');
    }

    function updateDescription(mode) {
        let desc = '';
        switch (mode) {
            case 'elementCapture':
                desc = 'Current Mode: Element Screenshot';
                break;
            case 'windowCapture':
                desc = 'Current Mode: Window Screenshot';
                break;
            case 'fullPageCapture':
                desc = 'Current Mode: Full Page Screenshot';
                break;
        }
        description.textContent = desc;
    }
});