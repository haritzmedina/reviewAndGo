const _ = require('lodash')
const Alerts = require('../utils/Alerts')
const Config = require('../Config')
const DefaultHighlighterGenerator = require('../specific/review/DefaultHighlighterGenerator')

const GroupName = Config.review.groupName

class GroupSelector {
  constructor () {
    this.groups = null
    this.currentGroup = null
    this.user = {}
  }

  init (callback) {
    console.debug('Initializing group selector')
    // Retrieve user profile (for further uses in other functionalities of the tool)
    this.retrieveUserProfile(() => {
      // Define current group
      this.defineCurrentGroup(() => {
        console.debug('Initialized group selector')
        if (_.isFunction(callback)) {
          callback(null)
        }
      })
    })
  }

  defineCurrentGroup (callback) {
    // Load all the groups belonged to current user
    this.retrieveHypothesisGroups((err, groups) => {
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
          // TODO i18n
          Alerts.loadingAlert({title: 'First time reviewing?', text: 'It seems that it is your first time using Review&Go. We are configuring everything to start reviewing.', position: Alerts.position.center})
          // Create default group
          DefaultHighlighterGenerator.createReviewHypothesisGroup((err, group) => {
            if (err) {
              Alerts.errorAlert({text: 'We are unable to create Hypothes.is group for Review&Go. Please check if you are logged in Hypothes.is.'})
            } else {
              this.currentGroup = group
              callback(null)
            }
          })
        }
      }
    })
  }

  retrieveHypothesisGroups (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.getListOfGroups({}, (err, groups) => {
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
    window.abwa.hypothesisClientManager.hypothesisClient.getUserProfile((err, profile) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.user = profile
        if (_.isFunction(callback)) {
          callback(null, profile.groups)
        }
      }
    })
  }

  destroy (callback) {
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

GroupSelector.eventGroupChange = 'hypothesisGroupChanged'

module.exports = GroupSelector
