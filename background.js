chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureFullPage') {
    chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error capturing screenshot:', chrome.runtime.lastError);
        return;
      }

      // Directly download the screenshot
      chrome.downloads.download({
        url: dataUrl,
        filename: `screenshot-${Date.now()}.png`
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
        }
      });
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
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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