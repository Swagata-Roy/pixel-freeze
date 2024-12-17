document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('modeToggle');
    const description = document.getElementById('modeDescription');

    // Retrieve and set initial state
    chrome.storage.sync.get('captureMode', (data) => {
        const mode = data.captureMode || 'elementCapture';
        toggle.checked = mode === 'fullPage';
        updateDescription(mode);
    });

    // Toggle event listener
    toggle.addEventListener('change', () => {
        const mode = toggle.checked ? 'fullPage' : 'elementCapture';

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

        // Update description
        updateDescription(mode);
    });

    function updateDescription(mode) {
        description.textContent = mode === 'fullPage' ?
            'Current Mode: Window Screenshot' :
            'Current Mode: Element Screenshot';
    }
});