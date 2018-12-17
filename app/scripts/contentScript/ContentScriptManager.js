const _ = require('lodash')
const ContentTypeManager = require('./ContentTypeManager')
const ModeManager = require('./ModeManager')
const Sidebar = require('./Sidebar')
const TagManager = require('./TagManager')
const GroupSelector = require('./GroupSelector')
const ConfigDecisionHelper = require('./ConfigDecisionHelper')
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
const UserFilter = require('./UserFilter')
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const RolesManager = require('./RolesManager')
const RubricManager = require('./RubricManager')

class ContentScriptManager {
  constructor () {
    this.events = {}
    this.status = ContentScriptManager.status.notInitialized
  }

  init () {
    console.log('Initializing content script manager')
    this.status = ContentScriptManager.status.initializing
    this.loadContentTypeManager(() => {
      window.abwa.hypothesisClientManager = new HypothesisClientManager()
      window.abwa.hypothesisClientManager.init(() => {
        window.abwa.sidebar = new Sidebar()
        window.abwa.sidebar.init(() => {
          window.abwa.annotationBasedInitializer = new AnnotationBasedInitializer()
          window.abwa.annotationBasedInitializer.init(() => {
            window.abwa.groupSelector = new GroupSelector()
            window.abwa.groupSelector.init(() => {
              window.abwa.roleManager = new RolesManager()
              window.abwa.roleManager.init(() => {
                window.abwa.modeManager = new ModeManager()
                window.abwa.modeManager.init(() => {
                  // Reload for first time the content by group
                  this.reloadContentByGroup()
                  // Initialize listener for group change to reload the content
                  this.initListenerForGroupChange()
                  this.status = ContentScriptManager.status.initialized
                  console.log('Initialized content script manager')
                })
              })
            })
          })
        })
      })
    })
  }

  initListenerForGroupChange () {
    this.events.groupChangedEvent = this.groupChangedEventHandlerCreator()
    document.addEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent, false)
  }

  groupChangedEventHandlerCreator () {
    return (event) => {
      this.reloadContentByGroup()
    }
  }

  reloadContentByGroup (callback) {
    ConfigDecisionHelper.decideWhichConfigApplyToTheGroup(window.abwa.groupSelector.currentGroup, (config) => {
      // If not configuration is found
      if (_.isEmpty(config)) {
        // TODO Inform user no defined configuration found
        console.debug('No supported configuration found for this group')
        this.destroyRolesManager()
        this.destroyTagsManager()
        this.destroyUserFilter()
        this.destroyContentAnnotator()
        this.destroySpecificContentManager()
      } else {
        console.debug('Loaded supported configuration %s', config.namespace)
        this.reloadRolesManager(config, () => {
          this.reloadRubricManager(config, () => {
            // Tags manager should go before content annotator, depending on the tags manager, the content annotator can change
            this.reloadTagsManager(config, () => {
              this.reloadContentAnnotator(config, () => {
                if (config.userFilter) {
                  this.reloadUserFilter(config, () => {
                    this.reloadSpecificContentManager(config)
                  })
                } else {
                  this.reloadSpecificContentManager(config)
                }
              })
            })
          })
        })
      }
    })
  }

  reloadRubricManager (config, callback) {
    this.destroyRubricManager()
    window.abwa.rubricManager = new RubricManager(config)
    window.abwa.rubricManager.init(callback)
  }

  reloadContentAnnotator (config, callback) {
    const TextAnnotator = require('./contentAnnotators/TextAnnotator')
    // Destroy current content annotator
    this.destroyContentAnnotator()
    // Create a new content annotator for the current group
    if (config.contentAnnotator === 'text') {
      window.abwa.contentAnnotator = new TextAnnotator(config)
    } else {
      window.abwa.contentAnnotator = new TextAnnotator(config)
    }
    window.abwa.contentAnnotator.init(callback)
  }

  reloadTagsManager (config, callback) {
    // Destroy current tag manager
    this.destroyTagsManager()
    // Create a new tag manager for the current group
    window.abwa.tagManager = new TagManager(config.namespace, config.tags)
    window.abwa.tagManager.init(callback)
  }

  reloadRolesManager (config, callback) {
    // Destroy current role manager
    this.destroyRolesManager()
    // Create a role manager for the current group
    window.abwa.roleManager = new RolesManager(config)
    window.abwa.roleManager.init()
    if (_.isFunction(callback)) {
      callback()
    }
  }

  destroyRubricManager (callback) {
    if (!_.isEmpty(window.abwa.rubricManager)) {
      window.abwa.rubricManager.destroy()
    }
  }

  destroyRolesManager (callback) {
    if (!_.isEmpty(window.abwa.roleManager)) {
      window.abwa.roleManager.destroy()
    }
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

  reloadUserFilter (config, callback) {
    // Destroy user filter
    this.destroyUserFilter()
    // Create user filter
    window.abwa.userFilter = new UserFilter(config)
    window.abwa.userFilter.init(callback)
  }

  destroyUserFilter (callback) {
    // Destroy current user filter
    if (!_.isEmpty(window.abwa.userFilter)) {
      window.abwa.userFilter.destroy()
    }
  }

  destroy (callback) {
    console.log('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyTagsManager()
      this.destroyContentAnnotator()
      this.destroyUserFilter()
      window.abwa.groupSelector.destroy(() => {
        window.abwa.sidebar.destroy(() => {
          window.abwa.hypothesisClientManager.destroy(() => {
            this.status = ContentScriptManager.status.notInitialized
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
      document.removeEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent)
    })
  }

  reloadSpecificContentManager (config, callback) {
    // Destroy current specific content manager
    this.destroySpecificContentManager()
    if (config.namespace === 'exam') {
      const ExamDataExtractionContentScript = require('../specific/exams/ExamDataExtractionContentScript')
      window.abwa.specificContentManager = new ExamDataExtractionContentScript(config)
      window.abwa.specificContentManager.init()
    }
  }

  destroySpecificContentManager () {
    if (window.abwa.specificContentManager) {
      window.abwa.specificContentManager.destroy()
    }
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
}

ContentScriptManager.status = {
  initializing: 'initializing',
  initialized: 'initialized',
  notInitialized: 'notInitialized'
}

module.exports = ContentScriptManager
