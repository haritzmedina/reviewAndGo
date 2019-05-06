const _ = require('lodash')

class Options {
  init () {
    // Load configuration
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
      if (_.isString(token)) {
        document.querySelector('#permissionHypothesisCheckbox').checked = true
      }
    })

    document.querySelector('#permissionHypothesisCheckbox').addEventListener('change', () => {
      this.updateHypothesisCheckbox()
    })
  }

  updateHypothesisCheckbox () {
    let isChecked = document.querySelector('#permissionHypothesisCheckbox').checked
    if (isChecked) {
      chrome.runtime.sendMessage({
        scope: 'hypothesis',
        cmd: 'userLoginForm'
      }, (response) => {
        console.debug('Permission to hypothesis granted')
      })
    } else {
      chrome.runtime.sendMessage({
        scope: 'hypothesis',
        cmd: 'userLogout'
      }, (response) => {
        console.debug('Revoked permission to hypothesis')
      })
    }
  }
}

module.exports = Options
