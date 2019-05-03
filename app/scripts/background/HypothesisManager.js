const DOM = require('../utils/DOM')
const $ = require('jquery')

const ChromeStorage = require('../utils/ChromeStorage')

const hypothesisSettings = require('../../settings/hypothesis')

const OAuthClient = require('../utils/oauth-client')

const checkHypothesisLoggedIntervalInSeconds = 3600 // fetch token every X seconds
const checkHypothesisLoggedInWhenPromptInSeconds = 5 // When user is prompted to login, the checking should be with higher period
const maxTries = 10 // max tries before deleting the token

class HypothesisManager {
  constructor () {
    // Define token
    this.token = null
    // Define tries before logout
    this.tries = 0
  }

  init () {
    this.client = new OAuthClient(hypothesisSettings)

    const authWindow = OAuthClient.openAuthPopupWindow(window)

    let promise = this.client.authorize(window, authWindow)

    promise.then(code => {
      this.client.exchangeAuthCode(code).then((token) => {
        console.log(token)
      })
    })
    /*
    // Try to load token for first time
    this.retrieveHypothesisToken((err, token) => {
      this.setToken(err, token)
    })

    // Create an observer to check if user is logged to hypothesis
    this.createRetryHypothesisTokenRetrieve()

    // Initialize replier for login form authentication
    this.initShowHypothesisLoginForm()

    // Initialize replier for requests of hypothesis related metadata
    this.initResponserForGetToken()
    */
  }

  createRetryHypothesisTokenRetrieve (intervalSeconds = checkHypothesisLoggedIntervalInSeconds) {
    let intervalHandler = () => {
      this.retrieveHypothesisToken((err, token) => {
        this.setToken(err, token)
      })
    }
    this.retrieveTokenInterval = setInterval(intervalHandler, intervalSeconds * 1000)
  }

  changeTokenRetrieveInterval (seconds = checkHypothesisLoggedIntervalInSeconds) {
    clearInterval(this.retrieveTokenInterval)
    this.createRetryHypothesisTokenRetrieve(seconds)
  }

  retrieveHypothesisToken (callback) {
    let callSettings = {
      'async': true,
      'crossDomain': true,
      'url': 'https://hypothes.is/account/developer',
      'method': 'GET'
    }

    DOM.scrapElement(callSettings, '#token', (error, resultNodes) => {
      if (error) {
        callback(error)
      } else {
        if (!resultNodes[0]) {
          $.post('https://hypothes.is/account/developer', () => {
            DOM.scrapElement(callSettings, '#token', (error, resultNodes) => {
              if (error) {
                callback(error)
              } else {
                let hypothesisToken = resultNodes[0].value
                callback(null, hypothesisToken)
              }
            })
          })
        } else {
          let hypothesisToken = resultNodes[0].value
          callback(null, hypothesisToken)
        }
      }
    })
  }

  setToken (err, token) {
    if (err) {
      console.error('The token is unreachable')
      if (this.tries >= maxTries) { // The token is unreachable after some tries, probably the user is logged out
        this.token = null // Probably the website is down or the user has been logged out
        console.error('The token is deleted after unsuccessful %s tries', maxTries)
      } else {
        this.tries += 1 // The token is unreachable, add a done try
        console.debug('The token is unreachable for %s time(s), but is maintained %s', this.tries, this.token)
      }
    } else {
      console.debug('User is logged in Hypothesis. His token is %s', token)
      this.token = token
      this.tries = 0
    }
  }

  initShowHypothesisLoginForm () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'hypothesis') {
        if (request.cmd === 'userLoginForm') {
          // Create new tab on google chrome
          chrome.tabs.create({url: 'https://hypothes.is/login'}, (tab) => {
            // Retrieve hypothesis token periodically
            let interval = setInterval(() => {
              this.retrieveHypothesisToken((err, token) => {
                if (err) {
                  console.debug('Checking again in %s seconds', checkHypothesisLoggedInWhenPromptInSeconds)
                } else {
                  // Once logged in, take the token and close the tab
                  this.token = token
                  chrome.tabs.remove(tab.id, () => {
                    clearInterval(interval)
                    sendResponse({token: this.token})
                  })
                }
              })
            }, checkHypothesisLoggedInWhenPromptInSeconds * 1000)
            // Set event for when user close the tab
            let closeTabListener = (closedTabId) => {
              if (closedTabId === tab.id && !this.token) {
                // Remove listener for hypothesis token
                clearInterval(interval)
                // Hypothes.is login tab is closed
                sendResponse({error: 'Hypothesis tab closed intentionally'})
              }
              chrome.tabs.onRemoved.removeListener(closeTabListener)
            }
            chrome.tabs.onRemoved.addListener(closeTabListener)
          })
        }
      }
      return true
    })
  }

  initResponserForGetToken () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'hypothesis') {
        if (request.cmd === 'getToken') {
          sendResponse(this.token)
        } else if (request.cmd === 'startListeningLogin') {
          this.changeTokenRetrieveInterval(checkHypothesisLoggedInWhenPromptInSeconds) // Reduce to 0.5 seconds
        } else if (request.cmd === 'stopListeningLogin') {
          this.changeTokenRetrieveInterval(checkHypothesisLoggedIntervalInSeconds) // Token retrieve to 20 seconds
        } else if (request.cmd === 'getUserProfileMetadata') {
          this.retrieveUserProfileMetadata((err, metadata) => {
            if (err) {
              sendResponse({error: 'Unable to retrieve profile metadata'})
            } else {
              sendResponse({metadata: metadata})
            }
          })
          return true // Async response
        }
      }
    })
  }

  retrieveUserProfileMetadata (callback) {
    let callSettings = {
      'async': true,
      'crossDomain': true,
      'url': 'https://hypothes.is/account/profile',
      'method': 'GET'
    }
    $.ajax(callSettings).done((resultString) => {
      let tempWrapper = document.createElement('div')
      tempWrapper.innerHTML = resultString
      try {
        callback(null, {
          displayName: tempWrapper.querySelector('[name="display_name"]').value,
          description: tempWrapper.querySelector('[name="description"]').value,
          location: tempWrapper.querySelector('[name="location"]').value,
          link: tempWrapper.querySelector('[name="link"]').value,
          orcid: tempWrapper.querySelector('[name="orcid"]').value
        })
      } catch (e) {
        callback(e)
      }
    }).fail((error) => {
      callback(error)
    })
  }
}

module.exports = HypothesisManager
