const ContentAnnotator = require('./ContentAnnotator')
const ModeManager = require('../ModeManager')
const ContentTypeManager = require('../ContentTypeManager')
const Tag = require('../Tag')
const TagGroup = require('../TagGroup')
const Events = require('../Events')
const RolesManager = require('../RolesManager')
const DOMTextUtils = require('../../utils/DOMTextUtils')
const PDFTextUtils = require('../../utils/PDFTextUtils')
const AnnotationUtils = require('../../utils/AnnotationUtils')
const LanguageUtils = require('../../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const _ = require('lodash')
require('components-jqueryui')
const Alerts = require('../../utils/Alerts')

const ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS = 3
const ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS = 60

const ReviewerAssistant = require('../../specific/review/ReviewAssistant')

let swal = require('sweetalert2')

class TextAnnotator extends ContentAnnotator {
  constructor (config) {
    super()
    this.events = {}
    this.config = config
    this.observerInterval = null
    this.reloadInterval = null
    this.currentAnnotations = null
    this.allAnnotations = null
    this.currentUserProfile = null
    this.highlightClassName = 'highlightedAnnotation'
  }

  init (callback) {
    this.initEvents(() => {
      // Retrieve current user profile
      this.currentUserProfile = window.abwa.groupSelector.user
      this.loadAnnotations(() => {
        this.initAnnotatorByAnnotation(() => {
          // Check if something is selected after loading annotations and display sidebar
          if (document.getSelection().toString().length !== 0) {
            if ($(document.getSelection().anchorNode).parents('#abwaSidebarWrapper').toArray().length === 0) {
              this.openSidebar()
            }
          }
          this.initAnnotationsObserver(() => {
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
    })
  }

  initEvents (callback) {
    this.initSelectionEvents(() => {
      this.initAnnotateEvent(() => {
        this.initModeChangeEvent(() => {
          this.initUserFilterChangeEvent(() => {
            this.initReloadAnnotationsEvent(() => {
              this.initDeleteAllAnnotationsEvent(() => {
                this.initDocumentURLChangeEvent(() => {
                  // Reload annotations periodically
                  if (_.isFunction(callback)) {
                    callback()
                  }
                })
              })
            })
          })
        })
      })
    })
  }

  initDocumentURLChangeEvent (callback) {
    this.events.documentURLChangeEvent = {element: document, event: Events.updatedDocumentURL, handler: this.createDocumentURLChangeEventHandler()}
    this.events.documentURLChangeEvent.element.addEventListener(this.events.documentURLChangeEvent.event, this.events.documentURLChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initDeleteAllAnnotationsEvent (callback) {
    this.events.deleteAllAnnotationsEvent = {element: document, event: Events.deleteAllAnnotations, handler: this.createDeleteAllAnnotationsEventHandler()}
    this.events.deleteAllAnnotationsEvent.element.addEventListener(this.events.deleteAllAnnotationsEvent.event, this.events.deleteAllAnnotationsEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createDeleteAllAnnotationsEventHandler (callback) {
    return () => {
      this.deleteAllAnnotations(() => {
        console.debug('All annotations deleted')
      })
    }
  }

  createDocumentURLChangeEventHandler (callback) {
    return () => {
      this.loadAnnotations(() => {
        console.debug('annotations updated')
      })
    }
  }

  initUserFilterChangeEvent (callback) {
    this.events.userFilterChangeEvent = {element: document, event: Events.userFilterChange, handler: this.createUserFilterChangeEventHandler()}
    this.events.userFilterChangeEvent.element.addEventListener(this.events.userFilterChangeEvent.event, this.events.userFilterChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initReloadAnnotationsEvent (callback) {
    this.reloadInterval = setInterval(() => {
      this.updateAllAnnotations(() => {
        console.debug('annotations updated')
      })
    }, ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS * 1000)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createUserFilterChangeEventHandler () {
    return (event) => {
      // This is only allowed in mode index
      if (window.abwa.modeManager.mode === ModeManager.modes.index) {
        let filteredUsers = event.detail.filteredUsers
        // Unhighlight all annotations
        this.unHighlightAllAnnotations()
        // Retrieve annotations for filtered users
        this.currentAnnotations = this.retrieveAnnotationsForUsers(filteredUsers)
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        this.highlightAnnotations(this.currentAnnotations)
      }
    }
  }

  /**
   * Retrieve from all annotations for the current document, those who user is one of the list in users
   * @param users
   * @returns {Array}
   */
  retrieveAnnotationsForUsers (users) {
    return _.filter(this.allAnnotations, (annotation) => {
      return _.find(users, (user) => {
        return annotation.user === 'acct:' + user + '@hypothes.is'
      })
    })
  }

  initModeChangeEvent (callback) {
    this.events.modeChangeEvent = {element: document, event: Events.modeChanged, handler: this.createInitModeChangeEventHandler()}
    this.events.modeChangeEvent.element.addEventListener(this.events.modeChangeEvent.event, this.events.modeChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createInitModeChangeEventHandler () {
    return () => {
      // If is mark or view disable the sidebar closing
      if (window.abwa.modeManager.mode === ModeManager.modes.mark || window.abwa.modeManager.mode === ModeManager.modes.view) {
        // Highlight all annotations
        this.currentAnnotations = this.allAnnotations
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        this.disableSelectionEvent()
      } else {
        // Unhighlight all annotations
        this.unHighlightAllAnnotations()
        // Highlight only annotations from current user
        this.currentAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        // Activate selection event and sidebar functionality
        this.activateSelectionEvent()
      }
    }
  }

  initAnnotateEvent (callback) {
    this.events.annotateEvent = {element: document, event: Events.annotate, handler: this.createAnnotationEventHandler()}
    this.events.annotateEvent.element.addEventListener(this.events.annotateEvent.event, this.events.annotateEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAnnotationEventHandler () {
    return (event) => {
      let selectors = []
      // If selection is empty, return null
      if (document.getSelection().toString().length === 0) {
        // If tag element is not checked, no navigation allowed
        if (event.detail.chosen === 'true') {
          // Navigate to the first annotation for this tag
          this.goToFirstAnnotationOfTag(event.detail.tags[0])
        } else {
          Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionEmpty')})
        }
        return
      }
      // If selection is child of sidebar, return null
      if ($(document.getSelection().anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
        Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionNotAnnotable')})
        return
      }
      let range = document.getSelection().getRangeAt(0)
      // Create FragmentSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'FragmentSelector' }) !== -1) {
        let fragmentSelector = null
        if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
          fragmentSelector = PDFTextUtils.getFragmentSelector(range)
        } else {
          fragmentSelector = DOMTextUtils.getFragmentSelector(range)
        }
        if (fragmentSelector) {
          selectors.push(fragmentSelector)
        }
      }
      // Create RangeSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'RangeSelector' }) !== -1) {
        let rangeSelector = DOMTextUtils.getRangeSelector(range)
        if (rangeSelector) {
          selectors.push(rangeSelector)
        }
      }
      // Create TextPositionSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'TextPositionSelector' }) !== -1) {
        let rootElement = window.abwa.contentTypeManager.getDocumentRootElement()
        let textPositionSelector = DOMTextUtils.getTextPositionSelector(range, rootElement)
        if (textPositionSelector) {
          selectors.push(textPositionSelector)
        }
      }
      // Create TextQuoteSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'TextQuoteSelector' }) !== -1) {
        let textQuoteSelector = DOMTextUtils.getTextQuoteSelector(range)
        if (textQuoteSelector) {
          selectors.push(textQuoteSelector)
        }
      }
      // Construct the annotation to send to hypothesis
      let annotation = TextAnnotator.constructAnnotation(selectors, event.detail.tags)
      window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(annotation, (err, annotation) => {
        if (err) {
          Alerts.errorAlert({text: 'Unexpected error, unable to create annotation'})
        } else {
          // Add to annotations
          this.allAnnotations.push(annotation)
          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
          // Send event annotation is created
          LanguageUtils.dispatchCustomEvent(Events.annotationCreated, {annotation: annotation})
          console.debug('Created annotation with ID: ' + annotation.id)
          this.highlightAnnotation(annotation, () => {
            window.getSelection().removeAllRanges()
          })
        }
      })
    }
  }

  static constructAnnotation (selectors, tags) {
    // Check if selectors exist, if then create a target for annotation, in other case the annotation will be a page annotation
    let target = []
    if (_.isObject(selectors)) {
      target.push({
        selector: selectors
      })
    }
    let data = {
      group: window.abwa.groupSelector.currentGroup.id,
      permissions: {
        read: ['group:' + window.abwa.groupSelector.currentGroup.id]
      },
      references: [],
      tags: tags,
      target: target,
      text: '',
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
    }
    // For pdf files it is also send the relationship between pdf fingerprint and web url
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let pdfFingerprint = window.abwa.contentTypeManager.pdfFingerprint
      data.document = {
        documentFingerprint: pdfFingerprint,
        link: [{
          href: 'urn:x-pdf:' + pdfFingerprint
        }, {
          href: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
        }]
      }
    }
    // If doi is available, add it to the annotation
    if (!_.isEmpty(window.abwa.contentTypeManager.doi)) {
      data.document = data.document || {}
      let doi = window.abwa.contentTypeManager.doi
      data.document.dc = { identifier: [doi] }
      data.document.highwire = { doi: [doi] }
      data.document.link = data.document.link || []
      data.document.link.push({href: 'doi:' + doi})
    }
    // If citation pdf is found
    if (!_.isEmpty(window.abwa.contentTypeManager.citationPdf)) {
      let pdfUrl = window.abwa.contentTypeManager.doi
      data.document.link = data.document.link || []
      data.document.link.push({href: pdfUrl, type: 'application/pdf'})
    }
    return data
  }

  initSelectionEvents (callback) {
    if (_.isEmpty(window.abwa.annotationBasedInitializer.initAnnotation)) {
      // Create selection event
      this.activateSelectionEvent(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  activateSelectionEvent (callback) {
    this.events.mouseUpOnDocumentHandler = {element: document, event: 'mouseup', handler: this.mouseUpOnDocumentHandlerConstructor()}
    this.events.mouseUpOnDocumentHandler.element.addEventListener(this.events.mouseUpOnDocumentHandler.event, this.events.mouseUpOnDocumentHandler.handler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  disableSelectionEvent (callback) {
    this.events.mouseUpOnDocumentHandler.element.removeEventListener(
      this.events.mouseUpOnDocumentHandler.event,
      this.events.mouseUpOnDocumentHandler.handler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  /**
   * Initializes annotations observer, to ensure dynamic web pages maintain highlights on the screen
   * @param callback Callback when initialization finishes
   */
  initAnnotationsObserver (callback) {
    this.observerInterval = setInterval(() => {
      if (this.currentAnnotations) {
        for (let i = 0; i < this.currentAnnotations.length; i++) {
          let annotation = this.currentAnnotations[i]
          // Search if annotation exist
          let element = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
          // If annotation doesn't exist, try to find it
          if (!_.isElement(element)) {
            Promise.resolve().then(() => { this.highlightAnnotation(annotation) })
          }
        }
      }
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // TODO Improve the way to highlight to avoid this interval (when search in PDFs it is highlighted empty element instead of element)
    this.cleanInterval = setInterval(() => {
      let highlightedElements = document.querySelectorAll('.highlightedAnnotation')
      highlightedElements.forEach((element) => {
        if (element.innerText === '') {
          $(element).remove()
        }
      })
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  loadAnnotations (callback) {
    this.updateAllAnnotations((err) => {
      if (err) {
        // TODO Show user no able to load all annotations
        console.error('Unable to load annotations')
      } else {
        // Current annotations will be
        this.currentAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        // Highlight annotations in the DOM
        this.highlightAnnotations(this.currentAnnotations)
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  updateAllAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
      group: window.abwa.groupSelector.currentGroup.id,
      order: 'asc'
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Get reply annotations
        this.replyAnnotations = _.remove(annotations, (annotation) => {
          return annotation.references && annotation.references.length > 0
        })
        // Search tagged annotations
        let filteringTags = window.abwa.tagManager.getFilteringTagList()
        this.allAnnotations = _.filter(annotations, (annotation) => {
          let tags = annotation.tags
          return !(tags.length > 0 && _.find(filteringTags, tags[0])) || (tags.length > 1 && _.find(filteringTags, tags[1]))
        })
        // Redraw all annotations
        this.redrawAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
        if (_.isFunction(callback)) {
          callback(null, this.allAnnotations)
        }
      }
    })
  }

  retrieveCurrentAnnotations () {
    return this.allAnnotations
  }

  highlightAnnotations (annotations, callback) {
    let promises = []
    annotations.forEach(annotation => {
      promises.push(new Promise((resolve) => {
        this.highlightAnnotation(annotation, resolve)
      }))
    })
    Promise.all(promises).then(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  highlightAnnotation (annotation, callback) {
    let classNameToHighlight = this.retrieveHighlightClassName(annotation)
    // Get annotation color for an annotation
    let tagInstance = window.abwa.tagManager.findAnnotationTagInstance(annotation)
    if (tagInstance) {
      let color = tagInstance.getColor()
      try {
        let highlightedElements = []
        // TODO Remove this case for google drive
        if (window.location.href.includes('drive.google.com')) {
          // Ensure popup exists
          if (document.querySelector('.a-b-r-x')) {
            highlightedElements = DOMTextUtils.highlightContent(
              annotation.target[0].selector, classNameToHighlight, annotation.id)
          }
        } else {
          highlightedElements = DOMTextUtils.highlightContent(
            annotation.target[0].selector, classNameToHighlight, annotation.id)
        }
        // Highlight in same color as button
        highlightedElements.forEach(highlightedElement => {
          // If need to highlight, set the color corresponding to, in other case, maintain its original color
          $(highlightedElement).css('background-color', color)
          // Set purpose color
          highlightedElement.dataset.color = color
          let group = null
          if (LanguageUtils.isInstanceOf(tagInstance, TagGroup)) {
            group = tagInstance
            // Set message
            highlightedElement.title = group.config.name + '\nLevel is pending, please right click to set a level.'
          } else if (LanguageUtils.isInstanceOf(tagInstance, Tag)) {
            group = tagInstance.group
            highlightedElement.title = group.config.name + '\nLevel: ' + tagInstance.name
          }
          if (!_.isEmpty(annotation.text)) {
            try {
              let feedback = JSON.parse(annotation.text)
              highlightedElement.title += '\nFeedback: ' + feedback.comment
            } catch (e) {
              highlightedElement.title += '\nFeedback: ' + annotation.text
            }
          }
        })
        // Create context menu event for highlighted elements
        this.createContextMenuForAnnotation(annotation)
        // Create click event to move to next annotation
        this.createNextAnnotationHandler(annotation)
      } catch (e) {
        // TODO Handle error (maybe send in callback the error ¿?)
        if (_.isFunction(callback)) {
          callback(new Error('Element not found'))
        }
      } finally {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    }
  }

  createNextAnnotationHandler (annotation) {
    let annotationIndex = _.findIndex(
      this.currentAnnotations,
      (currentAnnotation) => { return currentAnnotation.id === annotation.id })
    let nextAnnotationIndex = _.findIndex(
      this.currentAnnotations,
      (currentAnnotation) => { return _.isEqual(currentAnnotation.tags, annotation.tags) },
      annotationIndex + 1)
    // If not next annotation found, retrieve the first one
    if (nextAnnotationIndex === -1) {
      nextAnnotationIndex = _.findIndex(
        this.currentAnnotations,
        (currentAnnotation) => { return _.isEqual(currentAnnotation.tags, annotation.tags) })
    }
    // If annotation is different, create event
    if (nextAnnotationIndex !== annotationIndex) {
      let highlightedElements = document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')
      for (let i = 0; i < highlightedElements.length; i++) {
        let highlightedElement = highlightedElements[i]
        highlightedElement.addEventListener('click', () => {
          // If mode is mark or view, move to next annotation
          if (window.abwa.modeManager.mode === ModeManager.modes.mark || window.abwa.modeManager.mode === ModeManager.modes.view) {
            this.goToAnnotation(this.currentAnnotations[nextAnnotationIndex])
          }
        })
      }
    }
  }

  createContextMenuForAnnotation (annotation) {
    // Get elements for current group
    let groupTag = window.abwa.tagManager.getGroupFromAnnotation(annotation)
    $.contextMenu({
      selector: '[data-annotation-id="' + annotation.id + '"]',
      build: () => {
        // Create items for context menu
        let items = {}
        // If current user is the same as author, allow to remove annotation or add a comment
        if (window.abwa.rolesManager.role === RolesManager.roles.reviewer) {
          //  If a reply already exist show reply, otherwise show comment
          let replies = this.getRepliesForAnnotation(annotation)
          if (replies.length > 0) {
            items['reply'] = {name: 'Reply'}
          } else {
            items['comment'] = {name: 'Comment'}
          }
          items['delete'] = {name: 'Delete annotation'}
          items['separator'] = {'type': 'cm_separator'}
          // Construct levels
          _.forEach(groupTag.tags, (tag) => {
            items['level_' + tag.name] = {name: tag.name}
          })
        } else if (window.abwa.rolesManager.role === RolesManager.roles.author) {
          // This is disabled by now, maybe in the future it will be interesting to provide a reply mechanism
          // In the same way, if the author cannot reply to reviewer annotation, the rest of the functionality in this .js about replying will not be used
          // items['reply'] = {name: 'Reply'}
        }
        return {
          callback: (key, opt) => {
            if (key === 'delete') {
              this.deleteAnnotationHandler(annotation)
            } else if (key === 'comment') {
              this.commentAnnotationHandler(annotation)
            } else if (key === 'reply') {
              this.replyAnnotationHandler(annotation)
            } else if (key.startsWith('level_')) {
              let levelName = key.replace('level_', '')
              let level = _.find(groupTag.tags, (tag) => { return tag.name === levelName })
              this.giveLevelToAnnotationHandler(annotation, level)
              ReviewerAssistant.checkBalanced()
            }
          },
          items: items
        }
      }
    })
  }

  giveLevelToAnnotationHandler (annotation, level) {
    // Get tags for level
    if (level.tags) {
      let tags = level.tags
      annotation.tags = tags
      window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(
        annotation.id,
        annotation,
        (err, annotation) => {
          if (err) {
            // Show error message
            Alerts.errorAlert({text: chrome.i18n.getMessage('errorUpdatingAnnotationComment')})
          } else {
            // Update current annotations
            let currentIndex = _.findIndex(this.currentAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
            this.currentAnnotations.splice(currentIndex, 1, annotation)
            // Update all annotations
            let allIndex = _.findIndex(this.allAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
            this.allAnnotations.splice(allIndex, 1, annotation)
            // Dispatch updated annotations events
            LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
            LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
            LanguageUtils.dispatchCustomEvent(Events.comment, {annotation: annotation})
            // Redraw annotations
            DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
            this.highlightAnnotation(annotation)
          }
        })
    } else {
      Alerts.errorAlert({text: 'No tags found for current level. Unexpected error.' + chrome.i18n.getMessage('ContactAdministrator')})
    }
  }

  replyAnnotationHandler (annotation) {
    // Get annotations replying current annotation
    let repliesData = this.createRepliesData(annotation)
    let inputValue = ''
    if (_.last(repliesData.replies) && _.last(repliesData.replies).user === window.abwa.groupSelector.user.userid) {
      inputValue = _.last(repliesData.replies).text
    }

    Alerts.inputTextAlert({
      input: 'textarea',
      inputPlaceholder: inputValue || 'Type your reply here...',
      inputValue: inputValue || '',
      html: repliesData.htmlText,
      callback: (err, result) => {
        if (err) {

        } else {
          if (_.isEmpty(inputValue)) {
            // The comment you are writing is new
            let replyAnnotationData = TextAnnotator.constructAnnotation()
            // Add text
            replyAnnotationData.text = result
            // Add its reference (the annotation that replies to
            replyAnnotationData.references = [annotation.id]
            window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(replyAnnotationData, (err, replyAnnotation) => {
              if (err) {
                // Show error when creating annotation
                Alerts.errorAlert({text: 'There was an error when replying, please try again. Make sure you are logged in Hypothes.is.'})
              } else {
                // Dispatch event of new reply is created
                LanguageUtils.dispatchCustomEvent(Events.reply, {
                  replyType: 'new',
                  annotation: annotation,
                  replyAnnotation: replyAnnotation
                })
                // Add reply to reply list
                this.replyAnnotations.push(replyAnnotation)
              }
            })
          } else {
            // The comment you are writing is a modification of the latest one
            window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(_.last(repliesData.replies).id, {

            }, (err, replyAnnotation) => {
              if (err) {
                // Show error when updating annotation
                Alerts.errorAlert({text: 'There was an error when editing your reply, please try again. Make sure you are logged in Hypothes.is.'})
              } else {
                // TODO Remove the comment and create the new one in moodle
                LanguageUtils.dispatchCustomEvent(Events.reply, {
                  replyType: 'update',
                  annotation: annotation,
                  replyAnnotation: replyAnnotation,
                  originalText: inputValue
                })
              }
            })
          }
          console.log(result)
        }
      }
    })
  }

  createRepliesData (annotation) {
    let replies = this.getRepliesForAnnotation(annotation)
    // What and who
    let htmlText = ''
    for (let i = 0; i < replies.length - 1; i++) {
      let reply = replies[i]
      htmlText += this.createReplyLog(reply)
      if (replies.length - 2 > i) {
        htmlText += '<hr/>'
      }
    }
    // If last reply is from current user, don't show it in reply chain, it will be shown as comment to be edited
    let lastReply = _.last(replies)
    if (lastReply) {
      if (lastReply.user !== window.abwa.groupSelector.user.userid) {
        htmlText += '<hr/>'
        htmlText += this.createReplyLog(lastReply)
      }
    }
    return {htmlText: htmlText, replies: replies}
  }

  getRepliesForAnnotation (annotation) {
    let replies = _.filter(this.replyAnnotations, (replyAnnotation) => {
      return AnnotationUtils.isReplyOf(annotation, replyAnnotation)
    })
    replies = _.orderBy(replies, 'updated')
    return replies
  }

  createReplyLog (reply) {
    let htmlText = ''
    // Add user name
    if (reply.user === window.abwa.groupSelector.user.userid) {
      htmlText += '<span class="reply_user">You: </span>'
    } else {
      let username = reply.user.split('acct:')[1].split('@hypothes.is')[0]
      htmlText += '<span class="reply_user">' + username + ': </span>'
    }
    // Add comment
    htmlText += '<span class="reply_text">' + reply.text + '</span>'
    return htmlText
  }

  deleteAnnotationHandler (annotation) {
    // Delete annotation
    window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(annotation.id, (err, result) => {
      if (err) {
        // Unable to delete this annotation
        console.error('Error while trying to delete annotation %s', annotation.id)
      } else {
        if (!result.deleted) {
          // Alert user error happened
          Alerts.errorAlert({text: chrome.i18n.getMessage('errorDeletingHypothesisAnnotation')})
        } else {
          // Remove annotation from data model
          _.remove(this.currentAnnotations, (currentAnnotation) => {
            return currentAnnotation.id === annotation.id
          })
          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
          _.remove(this.allAnnotations, (currentAnnotation) => {
            return currentAnnotation.id === annotation.id
          })
          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
          // Dispatch deleted annotation event
          LanguageUtils.dispatchCustomEvent(Events.annotationDeleted, {annotation: annotation})
          // Unhighlight annotation highlight elements
          DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
          console.debug('Deleted annotation ' + annotation.id)
        }
      }
    })
  }

  commentAnnotationHandler (annotation) {
    // Close sidebar if opened
    let isSidebarOpened = window.abwa.sidebar.isOpened()
    this.closeSidebar()
    // Open sweetalert
    let that = this

    let updateAnnotation = (comment, literature) => {
      annotation.text = JSON.stringify({comment: comment, suggestedLiterature: literature})
      // annotation.text = newComment || ''
      window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(
        annotation.id,
        annotation,
        (err, annotation) => {
          if (err) {
            // Show error message
            Alerts.errorAlert({text: chrome.i18n.getMessage('errorUpdatingAnnotationComment')})
          } else {
            // Update current annotations
            let currentIndex = _.findIndex(that.currentAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
            that.currentAnnotations.splice(currentIndex, 1, annotation)
            // Update all annotations
            let allIndex = _.findIndex(that.allAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
            that.allAnnotations.splice(allIndex, 1, annotation)
            // Dispatch updated annotations events
            LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: that.currentAnnotations})
            LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: that.allAnnotations})
            // Redraw annotations
            DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
            that.highlightAnnotation(annotation)
          }
        })
      if (isSidebarOpened) {
        that.openSidebar()
      }
    }
    let showAlert = (form) => {
      let suggestedLiteratureHtml = (lit) => {
        let html = ''
        for (let i in lit) {
          html += '<li><a class="removeReference"></a><span title="' + lit[i] + '">' + lit[i] + '</span></li>'
        }
        return html
      }

      swal({
        html: '<textarea id="swal-textarea" class="swal2-textarea" placeholder="Type your feedback here...">' + form.comment + '</textarea>' + '<input placeholder="Suggest literature" id="swal-input1" class="swal2-input"><ul id="literatureList">' + suggestedLiteratureHtml(form.suggestedLiterature) + '</ul>',
        showLoaderOnConfirm: true,
        preConfirm: () => {
          let newComment = $('#swal-textarea').val()
          let suggestedLiterature = Array.from($('#literatureList li span')).map((e) => { return $(e).attr('title') })
          if (newComment !== null && newComment !== '') {
            $.ajax('http://text-processing.com/api/sentiment/', {
              method: 'POST',
              data: {text: newComment}
            }).done(function (ret) {
              if (ret.label === 'neg' && ret.probability.neg > 0.55) {
                swal({
                  type: 'warning',
                  text: 'The message may be ofensive. Please modify it.',
                  showCancelButton: true,
                  cancelButtonText: 'Modify comment',
                  confirmButtonText: 'Save as it is',
                  reverseButtons: true
                }).then((result) => {
                  if (result.value) {
                    updateAnnotation(newComment, suggestedLiterature)
                  } else if (result.dismiss === swal.DismissReason.cancel) {
                    showAlert({comment: newComment, suggestedLiterature: suggestedLiterature})
                  }
                })
              } else {
                // Update annotation
                updateAnnotation(newComment, suggestedLiterature)
              }
            })
          } else {
            // Update annotation
            updateAnnotation('', suggestedLiterature)
          }
        },
        onOpen: () => {
          $('.removeReference').on('click', function () {
            $(this).closest('li').remove()
          })
        }
      })

      $('#swal-input1').autocomplete({
        source: function (request, response) {
          $.ajax({
            url: 'http://dblp.org/search/publ/api',
            data: {
              q: request.term,
              format: 'json',
              h: 5
            },
            success: function (data) {
              response(data.result.hits.hit.map((e) => { return {label: e.info.title + ' (' + e.info.year + ')', value: e.info.title + ' (' + e.info.year + ')', info: e.info} }))
            }
          })
        },
        minLength: 3,
        delay: 500,
        select: function (event, ui) {
          let content = ''
          if (ui.item.info.authors !== null && Array.isArray(ui.item.info.authors.author)) {
            content += ui.item.info.authors.author.join(', ') + ': '
          } else if (ui.item.info.authors !== null) {
            content += ui.item.info.authors.author + ': '
          }
          if (ui.item.info.title !== null) {
            content += ui.item.info.title
          }
          if (ui.item.info.year !== null) {
            content += ' (' + ui.item.info.year + ')'
          }
          let a = document.createElement('a')
          a.className = 'removeReference'
          a.addEventListener('click', function (e) {
            $(e.target).closest('li').remove()
          })
          let li = document.createElement('li')
          $(li).append(a, '<span title="' + content + '">' + content + '</span>')
          $('#literatureList').append(li)
          setTimeout(function () {
            $('#swal-input1').val('')
          }, 10)
        },
        appendTo: '.swal2-container',
        create: function () {
          $('.ui-autocomplete').css('max-width', $('#swal2-content').width())
        }
      })
    }
    if (annotation.text === null || annotation.text === '') {
      showAlert({comment: '', suggestedLiterature: []})
    } else {
      showAlert(JSON.parse(annotation.text))
    }
  }

  retrieveHighlightClassName () {
    return this.highlightClassName // TODO Depending on the status of the application
  }

  mouseUpOnDocumentHandlerConstructor () {
    return (event) => {
      // Check if something is selected
      if (document.getSelection().toString().length !== 0) {
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0 &&
          $(event.target).parents('.swal2-container').toArray().length === 0
        ) {
          this.openSidebar()
        }
      } else {
        console.debug('Current selection is empty')
        // If selection is child of sidebar, return null
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0 &&
          event.target.id !== 'context-menu-layer') {
          console.debug('Current selection is not child of the annotator sidebar')
          this.closeSidebar()
        }
      }
    }
  }

  goToFirstAnnotationOfTag (tag) {
    // TODO Retrieve first annotation for tag
    let annotation = _.find(this.currentAnnotations, (annotation) => {
      return annotation.tags.includes(tag)
    })
    if (annotation) {
      this.goToAnnotation(annotation)
    }
  }

  goToAnnotation (annotation) {
    // If document is pdf, the DOM is dynamic, we must scroll to annotation using PDF.js FindController
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let queryTextSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
      if (queryTextSelector && queryTextSelector.exact) {
        window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
        // Get page for the annotation
        let fragmentSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'FragmentSelector' })
        if (fragmentSelector && fragmentSelector.page) {
          // Check if annotation was found by 'find' command, otherwise go to page
          setTimeout(() => {
            if (window.PDFViewerApplication.page !== fragmentSelector.page) {
              window.PDFViewerApplication.page = fragmentSelector.page
            }
          })
        }
      }
    } else { // Else, try to find the annotation by data-annotation-id element attribute
      let firstElementToScroll = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
      if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
        this.initializationTimeout = setTimeout(() => {
          console.debug('Trying to scroll to init annotation in 2 seconds')
          this.initAnnotatorByAnnotation()
        }, 2000)
      } else {
        firstElementToScroll.scrollIntoView({behavior: 'smooth', block: 'center'})
      }
    }
  }

  closeSidebar () {
    super.closeSidebar()
  }

  openSidebar () {
    super.openSidebar()
  }

  destroy () {
    // Remove observer interval
    clearInterval(this.observerInterval)
    // Clean interval
    clearInterval(this.cleanInterval)
    // Remove reload interval
    clearInterval(this.reloadInterval)
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Unhighlight all annotations
    this.unHighlightAllAnnotations()
  }

  unHighlightAllAnnotations () {
    // Remove created annotations
    let highlightedElements = [...document.querySelectorAll('[data-annotation-id]')]
    DOMTextUtils.unHighlightElements(highlightedElements)
  }

  initAnnotatorByAnnotation (callback) {
    // Check if init annotation exists
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      let initAnnotation = window.abwa.annotationBasedInitializer.initAnnotation
      // If document is pdf, the DOM is dynamic, we must scroll to annotation using PDF.js FindController
      if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
        let queryTextSelector = _.find(initAnnotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
        if (queryTextSelector && queryTextSelector.exact) {
          window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
        }
      } else { // Else, try to find the annotation by data-annotation-id element attribute
        let firstElementToScroll = document.querySelector('[data-annotation-id="' + initAnnotation.id + '"]')
        if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
          this.initializationTimeout = setTimeout(() => {
            console.debug('Trying to scroll to init annotation in 2 seconds')
            this.initAnnotatorByAnnotation()
          }, 2000)
        } else {
          if (_.isElement(firstElementToScroll)) {
            firstElementToScroll.scrollIntoView({behavior: 'smooth', block: 'center'})
          } else {
            // Unable to go to the annotation
          }
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  /**
   * Giving a list of old tags it changes all the annotations for the current document to the new tags
   * @param oldTags
   * @param newTags
   * @param callback Error, Result
   */
  updateTagsForAllAnnotationsWithTag (oldTags, newTags, callback) {
    // Get all annotations with oldTags
    let oldTagsAnnotations = _.filter(this.allAnnotations, (annotation) => {
      let tags = annotation.tags
      return oldTags.every((oldTag) => {
        return tags.includes(oldTag)
      })
    })
    let promises = []
    for (let i = 0; i < oldTagsAnnotations.length; i++) {
      let oldTagAnnotation = oldTagsAnnotations[i]
      promises.push(new Promise((resolve, reject) => {
        oldTagAnnotation.tags = newTags
        window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(oldTagAnnotation.id, oldTagAnnotation, (err, annotation) => {
          if (err) {
            reject(new Error('Unable to update annotation ' + oldTagAnnotation.id))
          } else {
            resolve(annotation)
          }
        })
      }))
    }
    let annotations = []
    Promise.all(promises).then((result) => {
      // All annotations updated
      annotations = result
    }).finally((result) => {
      if (_.isFunction(callback)) {
        callback(null, annotations)
      }
    })
  }

  redrawAnnotations () {
    // Unhighlight all annotations
    this.unHighlightAllAnnotations()
    // Highlight all annotations
    this.highlightAnnotations(this.allAnnotations)
  }

  deleteAllAnnotations () {
    // Retrieve all the annotations
    let allAnnotations = this.allAnnotations
    // Delete all the annotations
    let promises = []
    for (let i = 0; i < allAnnotations.length; i++) {
      promises.push(new Promise((resolve, reject) => {
        window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(allAnnotations[i].id, (err) => {
          if (err) {
            reject(new Error('Unable to delete annotation id: ' + allAnnotations[i].id))
          } else {
            resolve()
          }
        })
        return true
      }))
    }
    // When all the annotations are deleted
    Promise.all(promises).catch(() => {
      Alerts.errorAlert({text: 'There was an error when trying to delete all the annotations, please reload and try it again.'})
    }).then(() => {
      // Update annotation variables
      this.allAnnotations = []
      this.currentAnnotations = []
      // Dispatch event and redraw annotations
      LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
      this.redrawAnnotations()
    })
  }
}

module.exports = TextAnnotator
