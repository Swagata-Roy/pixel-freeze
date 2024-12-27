chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureFullPage') {
    // Regular tab capture
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Screenshot capture error:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError });
      } else {
        if (request.isWindowCapture) {
          // For window capture, download directly
          chrome.downloads.download({
            url: dataUrl,
            filename: `window-screenshot-${Date.now()}.png`
          });
        } else {
          // For full page parts, send back to content script
          sendResponse({ dataUrl: dataUrl });
        }
      }
    });
    return true; // Required for async sendResponse
  }

  if (request.action === 'processFullPageScreenshot') {
    // Create helper page for processing
    chrome.tabs.create({
      url: 'screenshot-helper.html',
      active: false
    }, (tab) => {
      const helperTabId = tab.id;
      let timeoutId;

      // Set a safety timeout to close the tab if processing fails
      timeoutId = setTimeout(() => {
        chrome.tabs.remove(helperTabId);
      }, 30000); // 30 second timeout

      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === helperTabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(helperTabId, {
            action: 'processScreenshots',
            screenshots: request.screenshots,
            dimensions: request.dimensions,
            tabId: helperTabId // Pass the tab ID to the helper
          });
        }
      });

      // Listen for tab close requests
      chrome.runtime.onMessage.addListener(function closeListener(msg) {
        if (msg.action === 'closeHelperTab' && msg.tabId === helperTabId) {
          clearTimeout(timeoutId);
          chrome.tabs.remove(helperTabId);
          chrome.runtime.onMessage.removeListener(closeListener);
        }
      });
    });
  }

  if (request.action === 'downloadProcessedScreenshot') {
    chrome.downloads.download({
      url: request.dataUrl,
      filename: `fullpage-screenshot-${Date.now()}.png`
    }, () => {
      // The tab will close itself via the closeHelperTab message
    });
  }

  if (request.action === 'captureSelectedArea') {
    chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error capturing screenshot:', chrome.runtime.lastError);
        return;
      }

      // Send the full screenshot data back to content script for cropping
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'cropAndDownload',
        dataUrl: dataUrl,
        rect: request.rect
      });
    });
  }

  if (request.action === 'downloadCroppedImage') {
    chrome.downloads.download({
      url: request.dataUrl,
      filename: `element-screenshot-${Date.now()}.png`
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Cropped image download failed:', chrome.runtime.lastError);
      }
    });
  }
});