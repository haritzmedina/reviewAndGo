class BrowserUtils {
  static getCurrentBrowser () {
    // Opera 8.0+
    let isOpera = (!!window.opr && !!window.opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0
    if (isOpera) {
      return BrowserUtils.browserList.opera
    }
    // Firefox 1.0+
    let isFirefox = typeof InstallTrigger !== 'undefined'
    if (isFirefox) {
      return BrowserUtils.browserList.firefox
    }
    // Safari 3.0+ "[object HTMLElementConstructor]"
    let isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === '[object SafariRemoteNotification]' })(!window['safari'] || (typeof safari !== 'undefined' && window.safari.pushNotification))
    if (isSafari) {
      return BrowserUtils.browserList.safari
    }

    // Edge 20+
    let isEdge = !window.isIE && !!window.StyleMedia
    if (isEdge) {
      return BrowserUtils.browserList.edge
    }
    // Chrome 1 - 71
    let isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime)
    if (isChrome) {
      return BrowserUtils.browserList.chrome
    }
    // Blink engine detection
    let isBlink = (isChrome || isOpera) && !!window.CSS
    if (isBlink) {
      return BrowserUtils.browserList.blink
    }
  }
}

BrowserUtils.browserList = {
  opera: 'opera',
  firefox: 'firefox',
  safari: 'safari',
  edge: 'edge',
  chrome: 'chrome',
  blink: 'blink'
}

module.exports = BrowserUtils
