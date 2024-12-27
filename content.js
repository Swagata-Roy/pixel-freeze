(() => {
    let captureMode = 'elementCapture'; // Default mode

    function initializeCaptureMode() {
        chrome.storage.sync.get('captureMode', (data) => {
            captureMode = data.captureMode || 'elementCapture';
            updateCaptureMode(captureMode);
        });
    }

    function updateCaptureMode(mode) {
        // Ensure selection overlay is hidden if not in element mode
        if (mode !== 'elementCapture') {
            if (selectionOverlay) {
                selectionOverlay.style.display = 'none';
            }
            if (selectionRect) {
                selectionRect.style.display = 'none';
            }
        }
    }

    async function captureFullPageScreenshot() {
        console.log('Starting full page screenshot capture');

        try {
            const originalScrollPos = window.scrollY;
            const originalOverflow = document.documentElement.style.overflow;
            const originalStyle = document.body.style.cssText;
            
            // Disable smooth scrolling and hide scrollbars
            document.documentElement.style.scrollBehavior = 'auto';
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            
            // Calculate accurate dimensions
            const totalHeight = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight,
                document.documentElement.offsetHeight,
                document.documentElement.clientHeight
            );
            const viewportHeight = window.innerHeight;
            const totalWidth = Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
                document.documentElement.offsetWidth,
                document.documentElement.clientWidth
            );
            
            const screenshots = [];
            const devicePixelRatio = window.devicePixelRatio || 1;
            const overlap = 50; // Pixels of overlap between screenshots

            // Take screenshots
            for (let scrollY = 0; scrollY < totalHeight; scrollY += (viewportHeight - overlap)) {
                // Ensure we don't scroll past the bottom
                const currentScrollY = Math.min(scrollY, totalHeight - viewportHeight);
                window.scrollTo(0, currentScrollY);
                
                // Wait for any dynamic content and scrolling to settle
                await new Promise(resolve => setTimeout(resolve, 250));

                try {
                    const dataUrl = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            action: 'captureFullPage'
                        }, response => {
                            if (chrome.runtime.lastError || response.error) {
                                reject(chrome.runtime.lastError || response.error);
                            } else {
                                resolve(response.dataUrl);
                            }
                        });
                    });

                    screenshots.push({
                        dataUrl,
                        scrollY: currentScrollY,
                        height: viewportHeight,
                        width: totalWidth,
                        isLastPart: (currentScrollY + viewportHeight >= totalHeight)
                    });
                } catch (error) {
                    console.error('Error capturing viewport:', error);
                }
            }

            // Restore original state
            document.documentElement.style.scrollBehavior = '';
            document.documentElement.style.overflow = originalOverflow;
            document.body.style.cssText = originalStyle;
            window.scrollTo(0, originalScrollPos);

            if (screenshots.length > 0) {
                chrome.runtime.sendMessage({
                    action: 'processFullPageScreenshot',
                    screenshots: screenshots,
                    dimensions: {
                        totalWidth,
                        totalHeight,
                        viewportHeight,
                        devicePixelRatio,
                        overlap
                    }
                });
            }
        } catch (error) {
            console.error('Full page screenshot error:', error);
            // Restore original state
            document.documentElement.style.overflow = '';
            document.body.style.cssText = originalStyle;
            window.scrollTo(0, originalScrollPos);
        }
    }

    let isDrawing = false;
    let startX, startY;
    let selectionOverlay, selectionRect;

    function createSelectionOverlay() {
        // Create overlay for selection
        selectionOverlay = document.createElement('div');
        selectionOverlay.style.position = 'fixed';
        selectionOverlay.style.top = '0';
        selectionOverlay.style.left = '0';
        selectionOverlay.style.width = '100%';
        selectionOverlay.style.height = '100%';
        selectionOverlay.style.backgroundColor = 'rgba(0, 0, 255, 0.2)';
        selectionOverlay.style.zIndex = '9999';
        selectionOverlay.style.cursor = 'crosshair';
        selectionOverlay.style.display = 'none';

        // Create selection rectangle
        selectionRect = document.createElement('div');
        selectionRect.style.position = 'absolute';
        selectionRect.style.border = '2px solid blue';
        selectionRect.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
        selectionRect.style.display = 'none';

        selectionOverlay.appendChild(selectionRect);
        document.body.appendChild(selectionOverlay);
    }

    function initElementSelectionListeners() {
        // Mouse events for element selection
        selectionOverlay.addEventListener('mousedown', (e) => {
            isDrawing = true;
            startX = e.clientX;
            startY = e.clientY;

            selectionRect.style.left = `${startX}px`;
            selectionRect.style.top = `${startY}px`;
            selectionRect.style.width = '0px';
            selectionRect.style.height = '0px';
            selectionRect.style.display = 'block';
        });

        selectionOverlay.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;

            const currentX = e.clientX;
            const currentY = e.clientY;

            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);

            selectionRect.style.width = `${width}px`;
            selectionRect.style.height = `${height}px`;
            selectionRect.style.left = `${left}px`;
            selectionRect.style.top = `${top}px`;
        });

        selectionOverlay.addEventListener('mouseup', (e) => {
            if (!isDrawing) return;
            isDrawing = false;

            // Get selection rectangle
            const rect = selectionRect.getBoundingClientRect();

            // Hide overlay BEFORE sending the screenshot message
            selectionOverlay.style.display = 'none';
            selectionRect.style.display = 'none';

            // Add a small delay to ensure overlay is hidden before capturing
            setTimeout(() => {
                // Capture selected area
                if (rect.width > 0 && rect.height > 0) {
                    try {
                        chrome.runtime.sendMessage({
                            action: 'captureSelectedArea',
                            rect: {
                                left: Math.round(rect.left),
                                top: Math.round(rect.top),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height)
                            }
                        });
                    } catch (error) {
                        console.error('Error sending selected area screenshot:', error);
                    }
                }
            }, 50); // Small 50ms delay to ensure overlay is hidden
        });

        // Escape key to cancel selection
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && selectionOverlay.style.display === 'block') {
                selectionOverlay.style.display = 'none';
                selectionRect.style.display = 'none';
                isDrawing = false;
            }
        });
    }

    function captureNodeScreenshot(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        chrome.storage.sync.get('captureMode', (data) => {
            const currentMode = data.captureMode || 'elementCapture';

            switch (currentMode) {
                case 'fullPageCapture':
                    captureFullPageScreenshot();
                    break;
                case 'windowCapture':
                    chrome.runtime.sendMessage({
                        action: 'captureFullPage',
                        isWindowCapture: true
                    });
                    break;
                default: // elementCapture
                    if (selectionOverlay) {
                        selectionOverlay.style.display = 'block';
                        selectionRect.style.display = 'none';
                    }
            }
        });
    }

    // Listen for mode toggle messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'toggleMode') {
            // Update local and storage capture mode
            captureMode = request.mode;
            chrome.storage.sync.set({
                captureMode: request.mode
            });

            // Update UI based on new mode
            updateCaptureMode(request.mode);
        } else if (request.action === 'cropAndDownload') {
            // Crop and download screenshot
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const pixelRatio = window.devicePixelRatio || 1;
                const rect = request.rect;

                // Set canvas size to cropped region
                canvas.width = rect.width * pixelRatio;
                canvas.height = rect.height * pixelRatio;

                // Draw cropped image
                ctx.drawImage(
                    img,
                    rect.left * pixelRatio,
                    rect.top * pixelRatio,
                    rect.width * pixelRatio,
                    rect.height * pixelRatio,
                    0,
                    0,
                    rect.width * pixelRatio,
                    rect.height * pixelRatio
                );

                // Download cropped image
                const croppedDataUrl = canvas.toDataURL('image/png');
                chrome.runtime.sendMessage({
                    action: 'downloadCroppedImage',
                    dataUrl: croppedDataUrl
                });
            };
            img.src = request.dataUrl;
        }
    });

    // Create and initialize selection overlay
    createSelectionOverlay();
    initElementSelectionListeners();
    initializeCaptureMode();

    // Global keyboard shortcut listener
    document.addEventListener('keydown', (e) => {
        const isCtrlShiftX = (
            (e.ctrlKey || e.metaKey) &&
            e.shiftKey &&
            (e.key === 'X' || e.key === 'x')
        );

        if (isCtrlShiftX) {
            captureNodeScreenshot(e);
        }
    });
})();