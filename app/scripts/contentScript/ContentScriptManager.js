const _ = require('lodash')
const ContentTypeManager = require('./ContentTypeManager')
const Sidebar = require('./Sidebar')
const TagManager = require('./TagManager')
const ModeManager = require('./ModeManager')
const RolesManager = require('./RolesManager')
const GroupSelector = require('./GroupSelector')
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
const HypothesisClientManager = require('../storage/hypothesis/HypothesisClientManager')
const LocalStorageManager = require('../storage/local/LocalStorageManager')
const Config = require('../Config')

class ContentScriptManager {
  constructor () {
    this.events = {}
    this.status = ContentScriptManager.status.notInitialized
  }

  init () {
    console.debug('Initializing content script manager')
    this.status = ContentScriptManager.status.initializing
    this.loadContentTypeManager(() => {
      this.loadStorage(() => {
        window.abwa.sidebar = new Sidebar()
        window.abwa.sidebar.init(() => {
          window.abwa.annotationBasedInitializer = new AnnotationBasedInitializer()
          window.abwa.annotationBasedInitializer.init(() => {
            window.abwa.groupSelector = new GroupSelector()
            window.abwa.groupSelector.init(() => {
              window.abwa.rolesManager = new RolesManager()
              window.abwa.rolesManager.init(() => {
                window.abwa.modeManager = new ModeManager()
                window.abwa.modeManager.init(() => {
                  // Load tag manager
                  window.abwa.tagManager = new TagManager(Config.review.namespace, Config.review.tags)
                  window.abwa.tagManager.init(() => {
                    // Load content annotator
                    const TextAnnotator = require('./contentAnnotators/TextAnnotator')
                    window.abwa.contentAnnotator = new TextAnnotator(Config.review)
                    window.abwa.contentAnnotator.init(() => {
                      const ReviewContentScript = require('../specific/review/ReviewContentScript')
                      window.abwa.specificContentManager = new ReviewContentScript(Config.review)
                      window.abwa.specificContentManager.init(() => {
                        this.status = ContentScriptManager.status.initialized
                        console.debug('Initialized content script manager')
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  }

  destroyContentAnnotator () {
    // Destroy current content annotator
    if (!_.isEmpty(window.abwa.contentAnnotator)) {
      window.abwa.contentAnnotator.destroy()
    }
  }

  destroyTagsManager () {
    if (!_.isEmpty(window.abwa.tagManager)) {
      window.abwa.tagManager.destroy()
    }
  }

  destroy (callback) {
    console.debug('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyTagsManager()
      this.destroyContentAnnotator()
      // TODO Destroy groupSelector, roleManager,
      window.abwa.groupSelector.destroy(() => {
        window.abwa.sidebar.destroy(() => {
          window.abwa.storageManager.destroy(() => {
            this.status = ContentScriptManager.status.notInitialized
            console.debug('Correctly destroyed content script manager')
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
    })
  }

  loadContentTypeManager (callback) {
    window.abwa.contentTypeManager = new ContentTypeManager()
    window.abwa.contentTypeManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroyContentTypeManager (callback) {
    if (window.abwa.contentTypeManager) {
      window.abwa.contentTypeManager.destroy(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    }
  }

  loadStorage (callback) {
    chrome.runtime.sendMessage({scope: 'storage', cmd: 'getSelectedStorage'}, ({storage}) => {
      if (storage === 'hypothesis') {
        // Hypothesis
        window.abwa.storageManager = new HypothesisClientManager()
      } else {
        // Local storage
        window.abwa.storageManager = new LocalStorageManager()
      }
      window.abwa.storageManager.init((err) => {
        if (_.isFunction(callback)) {
          if (err) {
            callback(err)
          } else {
            callback()
          }
        }
      })
    })
  }
}

ContentScriptManager.status = {
  initializing: 'initializing',
  initialized: 'initialized',
  notInitialized: 'notInitialized'
}

module.exports = ContentScriptManager
