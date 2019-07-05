const _ = require('lodash')
const $ = require('jquery')
const Alerts = require('../utils/Alerts')
const Config = require('../Config')
const ImportSchema = require('../specific/review/ImportSchema')

const GroupName = Config.review.groupName

class GroupSelector {
  constructor () {
    this.groups = null
    this.currentGroup = null
    this.user = {}
  }

  init (callback) {
    console.debug('Initializing group selector')
    this.checkIsLoggedIn((err) => {
      if (err) {
        // Stop propagating the rest of the functions, because it is not logged in storage
        // Show that user need to log in remote storage to continue
        Alerts.errorAlert({
          title: 'Log in selected storage required',
          text: chrome.i18n.getMessage('StorageLoginRequired')
        })
      } else {
        // Retrieve user profile (for further uses in other functionalities of the tool)
        this.retrieveUserProfile(() => {
          // Define current group
          this.defineCurrentGroup(() => {
            this.reloadGroupsContainer()
            console.debug('Initialized group selector')
            if (_.isFunction(callback)) {
              callback(null)
            }
          })
        })
      }
    })
  }

  defineCurrentGroup (callback) {
    // Load all the groups belonged to current user
    this.retrieveGroups((err, groups) => {
      if (err) {

      } else {
        let group = _.find(groups, (group) => { return group.name === GroupName })
        if (_.isObject(group)) {
          // Current group will be that group
          this.currentGroup = group
          if (_.isFunction(callback)) {
            callback(null)
          }
        } else {
          ImportSchema.createReviewGroup((err, group) => {
            if (err) {
              Alerts.errorAlert({text: 'We are unable to create the annotation group for Review&Go. Please check if you are logged in the selected remote annotation storage (e.g.: Hypothes.is).'})
            } else {
              this.currentGroup = group
              callback(null)
            }
          })
        }
      }
    })
  }

  checkIsLoggedIn (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/groupSelection.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      if (!window.abwa.storageManager.isLoggedIn()) {
        // Display login/sign up form
        $('#notLoggedInGroupContainer').attr('aria-hidden', 'false')
        // Hide group container
        $('#loggedInGroupContainer').attr('aria-hidden', 'true')
        // Hide purposes wrapper
        $('#purposesWrapper').attr('aria-hidden', 'true')
        // Start listening to when is logged in continuously
        chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'startListeningLogin'})
        // Open the sidebar to notify user that needs to log in
        window.abwa.sidebar.openSidebar()
        if (_.isFunction(callback)) {
          callback(new Error('Is not logged in'))
        }
      } else {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  retrieveGroups (callback) {
    window.abwa.storageManager.client.getListOfGroups({}, (err, groups) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.groups = groups
        if (_.isFunction(callback)) {
          callback(null, groups)
        }
      }
    })
  }

  retrieveUserProfile (callback) {
    window.abwa.storageManager.client.getUserProfile((err, profile) => {
      if (err) {
        callback(err)
      } else {
        this.user = profile
        if (_.isFunction(callback)) {
          callback(null, profile.groups)
        }
      }
    })
  }

  reloadGroupsContainer (callback) {
    this.renderGroupsContainer()
  }

  renderGroupsContainer () {
    document.querySelector('#groupSelectorName').innerText = this.currentGroup.name
    document.querySelector('#groupSelectorName').addEventListener('click', this.createGroupSelectorToggleEvent())
    document.querySelector('#groupSelectorToggle').addEventListener('click', this.createGroupSelectorToggleEvent())
  }

  createGroupSelectorToggleEvent () {
    return (e) => {
      this.toggleGroupSelectorContainer()
    }
  }

  toggleGroupSelectorContainer () {
    let groupSelector = document.querySelector('#groupSelector')
    if (groupSelector.getAttribute('aria-expanded') === 'true') {
      groupSelector.setAttribute('aria-expanded', 'false')
    } else {
      groupSelector.setAttribute('aria-expanded', 'true')
    }
  }

  destroy (callback) {
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = GroupSelector
