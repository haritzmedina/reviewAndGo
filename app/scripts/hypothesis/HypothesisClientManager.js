const _ = require('lodash')

const Alerts = require('../utils/Alerts')

const HypothesisClient = require('hypothesis-api-client')

const reloadIntervalInSeconds = 10 // Reload the hypothesis client every 10 seconds

class HypothesisClientManager {
  constructor () {
    this.hypothesisClient = null
    this.hypothesisToken = null
    this.reloadInterval = null
  }

  init (callback) {
    this.reloadHypothesisClient(() => {
      // Start reloading of client
      this.reloadInterval = setInterval(() => {
        this.reloadHypothesisClient()
      }, reloadIntervalInSeconds * 1000)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  reloadHypothesisClient (callback) {
    if (_.has(window.background, 'hypothesisManager')) {
      if (_.isString(window.background.hypothesisManager.token)) {
        if (this.hypothesisToken !== window.background.hypothesisManager.token) {
          this.hypothesisToken = window.background.hypothesisManager.token
          if (this.hypothesisToken) {
            this.hypothesisClient = new HypothesisClient(window.background.hypothesisManager.token)
          } else {
            this.hypothesisClient = new HypothesisClient()
          }
        }
        if (_.isFunction(callback)) {
          callback()
        }
      } else {
        window.background.hypothesisManager.retrieveHypothesisToken((err, token) => {
          if (err) {
            this.hypothesisClient = new HypothesisClient()
            this.hypothesisToken = null
          } else {
            this.hypothesisClient = new HypothesisClient(token)
            this.hypothesisToken = token
          }
        })
      }
    } else {
      chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
        this.hypothesisToken = token
        if (this.hypothesisToken) {
          this.hypothesisClient = new HypothesisClient(token)
          if (_.isFunction(callback)) {
            callback()
          }
        } else {
          // Show that user need to log in hypothes.is to continue
          Alerts.infoAlert({
            title: 'Log in Hypothes.is required',
            text: chrome.i18n.getMessage('HypothesisLoginRequired'),
            callback: () => {
              chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'userLoginForm'}, (response) => {
                // Update hypothes.is client token
                this.reloadHypothesisClient(callback)
              })
            }
          })
        }
      })
    }
  }

  destroy (callback) {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = HypothesisClientManager
