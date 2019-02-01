const Alerts = require('../../utils/Alerts')
const Events = require('../../contentScript/Events')
const Criteria = require('../../model/schema/Criteria')
const Level = require('../../model/schema/Level')
const Review = require('../../model/schema/Review')
const DefaultCriterias = require('./DefaultCriterias')
const _ = require('lodash')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const Config = require('../../Config')

class CustomCriteriasManager {
  constructor () {
    this.events = {}
  }

  init (callback) {
    this.createAddCustomCriteriaButton(() => {
      // Initialize event handlers
      this.initEventHandler()
      // Initialize deleteable custom criterias menus
      this.initDeleteableCustomCriteriasContextMenu()
    })
  }

  initEventHandler () {
    this.events.tagsUpdated = {
      element: document,
      event: Events.tagsUpdated,
      handler: (event) => {
        this.createAddCustomCriteriaButton()
        this.initDeleteableCustomCriteriasContextMenu()
      }
    }
    this.events.tagsUpdated.element.addEventListener(this.events.tagsUpdated.event, this.events.tagsUpdated.handler, false)
  }

  createAddCustomCriteriaButton (callback) {
    // Get Other container
    let otherGroupContainer = document.querySelector('.groupName[title="Other"]').parentElement.querySelector('.tagButtonContainer')

    // Add separator between other criterias and creator
    let separator = document.createElement('hr')
    separator.className = 'separator'
    otherGroupContainer.prepend(separator)

    // Create button for new element
    let addCriteriaButton = document.createElement('button')
    addCriteriaButton.innerHTML = '<img class="buttonIcon" src="' + chrome.extension.getURL('/images/add.png') + '"/> new criteria'
    addCriteriaButton.className = 'customCriteriaButton'
    addCriteriaButton.addEventListener('click', this.createAddCustomCriteriaButtonHandler())

    // Prepend create new criteria button
    otherGroupContainer.prepend(addCriteriaButton)

    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAddCustomCriteriaButtonHandler () {
    return (event) => {
      let isSidebarOpened = window.abwa.sidebar.isOpened()
      window.abwa.sidebar.closeSidebar()
      Alerts.inputTextAlert({
        input: 'text',
        inputPlaceholder: 'Insert the name for the new criteria...',
        callback: (err, name) => {
          if (err) {
            Alerts.errorAlert({text: 'Unable to create this custom criteria, try it again.'})
          } else {
            this.createNewCustomCriteria({
              name: name,
              callback: () => {
                // Open sidebar again
                if (isSidebarOpened) {
                  window.abwa.sidebar.openSidebar()
                }
              }
            })
          }
        }
      })
    }
  }

  createNewCustomCriteria ({name, description = 'Custom criteria', callback}) {
    let review = new Review({reviewId: ''})
    review.hypothesisGroup = window.abwa.groupSelector.currentGroup
    let criteria = new Criteria({name, description, review, custom: true})
    // Create levels for the criteria
    let levels = DefaultCriterias.defaultLevels
    criteria.levels = []
    for (let j = 0; j < levels.length; j++) {
      let level = new Level({name: levels[j].name, criteria: criteria})
      criteria.levels.push(level)
    }
    let annotations = criteria.toAnnotations()
    // Push annotations to hypothes.is
    window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotations(annotations, (err, annotations) => {
      if (err) {
        Alerts.errorAlert({title: 'Unable to create a custom category', text: 'Error when trying to create a new custom category. Please try again.'})
        callback(err)
      } else {
        // Reload sidebar
        window.abwa.tagManager.reloadTags(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  destroy () {
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
  }

  initDeleteableCustomCriteriasContextMenu () {
    // If is a custom tag, create a context menu to able its deletion
    let arrayOfTagGroups = _.values(window.abwa.tagManager.model.currentTags)
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      if (tagGroup.config.options.custom) {
        $.contextMenu({
          selector: '[data-mark="' + tagGroup.config.name + '"]',
          build: () => {
            // Create items for context menu
            let items = {}
            items['delete'] = {name: 'Delete criteria'}
            return {
              callback: (key, opt) => {
                if (key === 'delete') {
                  // Ask user if they are sure to delete the current tag
                  Alerts.confirmAlert({
                    alertType: Alerts.alertType.question,
                    title: chrome.i18n.getMessage('DeleteCriteriaConfirmationTitle'),
                    text: chrome.i18n.getMessage('DeleteCriteriaConfirmationMessage'),
                    callback: (err, toDelete) => {
                      // It is run only when the user confirms the dialog, so delete all the annotations
                      if (err) {
                        // Nothing to do
                      } else {
                        this.deleteTag(tagGroup)
                      }
                    }
                  })
                }
              },
              items: items
            }
          }
        })
      }
    }
  }

  deleteTag (tagGroup) {
    // Get tags used in hypothes.is to store this tag or annotations with this tag
    let annotationsToDelete = []
    // Get annotation of the tag group
    annotationsToDelete.push(tagGroup.config.annotation.id)
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      tags: Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':' + tagGroup.config.name
    }, (err, annotations) => {
      if (err) {
        // TODO Send message unable to delete
      } else {
        annotationsToDelete = annotationsToDelete.concat(_.map(annotations, 'id'))
        // Delete all the annotations
        let promises = []
        for (let i = 0; i < annotationsToDelete.length; i++) {
          promises.push(new Promise((resolve, reject) => {
            window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(annotationsToDelete[i], (err) => {
              if (err) {
                reject(new Error('Unable to delete annotation id: ' + annotationsToDelete[i]))
              } else {
                resolve()
              }
            })
            return true
          }))
        }
        // When all the annotations are deleted
        Promise.all(promises).catch(() => {
          Alerts.errorAlert({text: 'There was an error when trying to delete all the annotations for this tag, please reload and try it again.'})
        }).then(() => {
          // Update tag manager and then update all annotations
          setTimeout(() => {
            window.abwa.tagManager.reloadTags(() => {
              window.abwa.contentAnnotator.updateAllAnnotations(() => {
                window.abwa.sidebar.openSidebar()
              })
            })
          }, 1000)
        })
      }
    })
  }
}

module.exports = CustomCriteriasManager
