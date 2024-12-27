chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processScreenshots') {
        processScreenshots(request.screenshots, request.dimensions)
            .then(finalDataUrl => {
                chrome.runtime.sendMessage({
                    action: 'downloadProcessedScreenshot',
                    dataUrl: finalDataUrl
                });
                // Send message to close this tab
                chrome.runtime.sendMessage({
                    action: 'closeHelperTab',
                    tabId: request.tabId
                });
            })
            .catch(error => {
                console.error('Processing error:', error);
                // Close tab even if there's an error
                chrome.runtime.sendMessage({
                    action: 'closeHelperTab',
                    tabId: request.tabId
                });
            });
    }
});

async function processScreenshots(screenshots, dimensions) {
    const canvas = document.getElementById('screenshotCanvas');
    canvas.width = dimensions.totalWidth * dimensions.devicePixelRatio;
    canvas.height = dimensions.totalHeight * dimensions.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    
    // Set background to white (in case the page has a transparent background)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        const img = new Image();
        
        await new Promise((resolve, reject) => {
            img.onload = () => {
                try {
                    // Calculate the exact position to draw this part
                    const drawY = screenshot.scrollY * dimensions.devicePixelRatio;
                    
                    // For all parts except the last one, clip the bottom overlap region
                    if (!screenshot.isLastPart) {
                        const height = (screenshot.height - dimensions.overlap) * dimensions.devicePixelRatio;
                        ctx.drawImage(
                            img,
                            0, 0, // source x, y
                            img.width, height, // source width, height
                            0, drawY, // destination x, y
                            screenshot.width * dimensions.devicePixelRatio,
                            height // destination width, height
                        );
                    } else {
                        // For the last part, draw the entire image
                        ctx.drawImage(
                            img,
                            0,
                            drawY,
                            screenshot.width * dimensions.devicePixelRatio,
                            screenshot.height * dimensions.devicePixelRatio
                        );
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = reject;
            img.src = screenshot.dataUrl;
        });
    }

    return canvas.toDataURL('image/png');
}
