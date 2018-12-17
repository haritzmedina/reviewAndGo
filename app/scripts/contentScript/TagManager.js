const _ = require('lodash')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const ModeManager = require('./ModeManager')
const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')
const AnnotationUtils = require('../utils/AnnotationUtils')
const Events = require('./Events')
const Tag = require('./Tag')
const TagGroup = require('./TagGroup')
const Alerts = require('../utils/Alerts')
const CircularJSON = require('circular-json-es6')

class TagManager {
  constructor (namespace, config) {
    this.model = {
      documentAnnotations: [],
      groupAnnotations: [],
      namespace: namespace,
      config: config
    }
    this.currentTags = []
    this.events = {}
  }

  init (callback) {
    console.debug('Initializing TagManager')
    this.initTagsStructure(() => {
      this.initEventHandlers(() => {
        this.initAllTags(() => {
          console.debug('Initialized TagManager')
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  getGroupAnnotations (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.groupSelector.currentGroup.links.html,
      order: 'desc'
    }, (err, annotations) => {
      if (err) {
        Alerts.errorAlert({text: 'Unable to construct the highlighter. Please reload webpage and try it again.'})
      } else {
        // Retrieve tags which has the namespace
        annotations = _.filter(annotations, (annotation) => {
          return this.hasANamespace(annotation, this.model.namespace)
        })
        // Remove slr:spreadsheet annotation ONLY for SLR case
        annotations = _.filter(annotations, (annotation) => {
          return !this.hasATag(annotation, 'slr:spreadsheet')
        })
        // Remove tags which are not for the current assignment
        let cmid = window.abwa.contentTypeManager.fileMetadata.cmid
        annotations = _.filter(annotations, (annotation) => {
          return this.hasATag(annotation, 'exam:cmid:' + cmid)
        })
        if (_.isFunction(callback)) {
          callback(annotations)
        }
      }
    })
  }

  initTagsStructure (callback) {
    let tagWrapperUrl = chrome.extension.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.tagsContainer = {evidencing: document.querySelector('#tagsEvidencing'), marking: document.querySelector('#tagsMarking'), viewing: document.querySelector('#tagsViewing')}
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  getTagsList () {
    if (this.currentTags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.currentTags[0], Tag)) {
        return this.currentTags
      } else if (LanguageUtils.isInstanceOf(this.currentTags[0], TagGroup)) {
        let tags = []
        for (let i = 0; i < this.currentTags.length; i++) {
          tags = tags.concat(this.currentTags[i].tags)
        }
        return tags
      }
    } else {
      return [] // No tags for current group
    }
  }

  static retrieveTagForAnnotation (annotation, tagList) {
    for (let i = 0; i < tagList.length; i++) {
      let difference = _.differenceWith(
        tagList[i].tags,
        annotation.tags,
        (tag1, tag2) => {
          return tag1.toLowerCase() === tag2.toLowerCase()
        })
      if (difference.length === 0) {
        return tagList[i]
      }
    }
  }

  initAllTags (callback) {
    this.getGroupAnnotations((annotations) => {
      // Add to model
      this.model.groupAnnotations = annotations
      // Create tags based on annotations
      this.currentTags = this.createTagsBasedOnAnnotations()
      // Populate tags containers for the modes
      this.createTagsButtonsForEvidencing()
      this.createTagsButtonsForMarking()
      this.createTagsButtonsForViewing()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  hasANamespace (annotation, namespace) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), (namespace + ':').toLowerCase())
    }) !== -1
  }

  hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), tag.toLowerCase())
    }) !== -1
  }

  createTagsBasedOnAnnotations () {
    let tagGroupsAnnotations = {}
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag, namespace: this.model.namespace, group: this.model.config.grouped.group, options: jsYaml.load(this.model.groupAnnotations[i].text)})
      }
    }
    let groups = _.sortBy(_.keys(tagGroupsAnnotations))
    let colorList = ColorUtils.getDifferentColors(groups.length)
    let colors = {}
    for (let i = 0; i < groups.length; i++) {
      colors[groups[i]] = colorList[i]
      tagGroupsAnnotations[groups[i]].config.color = colorList[i]
    }
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let tagAnnotation = this.model.groupAnnotations[i]
      let tagName = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.subgroup))
      let groupBelongedTo = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.relation))
      if (tagName && groupBelongedTo) {
        if (_.isArray(tagGroupsAnnotations[groupBelongedTo].tags)) {
          // Load options from annotation text body
          let options = jsYaml.load(tagAnnotation.text)
          tagGroupsAnnotations[groupBelongedTo].tags.push(new Tag({
            name: tagName,
            namespace: this.model.namespace,
            options: options || {},
            tags: [
              this.model.namespace + ':' + this.model.config.grouped.relation + ':' + groupBelongedTo,
              this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + tagName]
          }, tagGroupsAnnotations[groupBelongedTo]))
          this.model.currentTags = tagGroupsAnnotations
        }
      }
    }
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      // TODO Check all elements, not only tags[0]
      if (_.isNaN(_.parseInt(tagGroup.tags[0].name))) {
        tagGroup.tags = _.sortBy(tagGroup.tags, 'name')
      } else {
        tagGroup.tags = _.sortBy(tagGroup.tags, (tag) => _.parseInt(tag.name))
      }
      return tagGroup
    })
    // Set color for each code
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      if (tagGroup.tags.length > 0) {
        tagGroup.tags = _.map(tagGroup.tags, (tag, index) => {
          let color = ColorUtils.setAlphaToColor(colors[tagGroup.config.name], 0.2 + index / tagGroup.tags.length * 0.8)
          tag.options.color = color
          tag.color = color
          return tag
        })
      }
      return tagGroup
    })
    // For groups without sub elements
    let emptyGroups = _.filter(tagGroupsAnnotations, (group) => { return group.tags.length === 0 })
    for (let j = 0; j < emptyGroups.length; j++) {
      let options = {color: ColorUtils.setAlphaToColor(colors[emptyGroups[j].config.name], 0.5)}
      let index = _.findIndex(tagGroupsAnnotations, (tagGroup) => { return tagGroup.config.name === emptyGroups[j].config.name })
      if (index >= 0) {
        tagGroupsAnnotations[index].tags.push(new Tag({
          name: emptyGroups[j].config.name,
          namespace: emptyGroups[j].namespace,
          options: options,
          tags: [emptyGroups[j].config.namespace + ':' + emptyGroups[j].config.group + ':' + emptyGroups[j].config.name]
        }))
      }
    }
    // Hash to array
    return _.sortBy(tagGroupsAnnotations, 'config.name')
  }

  destroy () {
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Remove tags wrapper
    $('#tagsWrapper').remove()
  }

  retrieveTagNameByPrefix (annotationTags, prefix) {
    for (let i = 0; i < annotationTags.length; i++) {
      if (_.startsWith(annotationTags[i].toLowerCase(), prefix.toLowerCase())) {
        return _.replace(annotationTags[i], prefix + ':', '')
      }
    }
    return null
  }

  createTagsButtonsForEvidencing () {
    let arrayOfTagGroups = _.values(this.model.currentTags)
    arrayOfTagGroups = _.orderBy(arrayOfTagGroups, 'config.options.criteriaId')
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let button = this.createButton({
        name: tagGroup.config.name,
        color: ColorUtils.setAlphaToColor(tagGroup.config.color, 0.5),
        handler: (event) => {
          // Check if it is already marked to get current mark
          let currentMark = this.getCurrentMarkForCriteria(tagGroup.config.name)
          let tags = [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name,
            'exam:cmid:' + window.abwa.contentTypeManager.fileMetadata.cmid
          ]
          if (!_.isUndefined(currentMark) && !_.isNull(currentMark)) {
            tags.push(this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + currentMark)
          }
          LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: tags})
        }})
      this.tagsContainer.evidencing.append(button)
    }
  }

  getCurrentMarkForCriteria (criteriaName) {
    // TODO Get mark from any document for this student, not only in the current document ¿?
    let otherAnnotationSameCriteria = _.find(window.abwa.contentAnnotator.currentAnnotations, (annotation) => {
      let criteria = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
      return criteria === criteriaName
    })
    if (_.isObject(otherAnnotationSameCriteria)) {
      // Get if has mark
      let mark = AnnotationUtils.getTagSubstringFromAnnotation(otherAnnotationSameCriteria, 'exam:mark:')
      if (mark) {
        return mark
      } else {
        return null
      }
    }
  }

  createTagsButtonsForMarking () {
    let arrayOfTagGroups = _.values(this.model.currentTags)
    arrayOfTagGroups = _.orderBy(arrayOfTagGroups, 'config.options.criteriaId')
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let panel = this.createGroupedButtons({
        name: tagGroup.config.name,
        color: tagGroup.config.color,
        elements: tagGroup.tags,
        groupHandler: (event) => {
          // TODO Go to annotation with that group tag
          window.abwa.contentAnnotator.goToFirstAnnotationOfTag('exam:isCriteriaOf:' + tagGroup.config.name)
        },
        buttonHandler: (event) => {
          // Update all annotations for current document/tag
          let oldTagList = ['exam:isCriteriaOf:' + tagGroup.config.name]
          let newTagList = [
            'exam:isCriteriaOf:' + tagGroup.config.name,
            'exam:mark:' + event.target.dataset.mark,
            'exam:cmid:' + window.abwa.contentTypeManager.fileMetadata.cmid
          ]
          window.abwa.contentAnnotator.updateTagsForAllAnnotationsWithTag(
            oldTagList, newTagList,
            (err, annotations) => {
              if (err) {

              } else {
                //
                console.debug('All annotations with criteria ' + tagGroup.config.name + ' has mark ' + event.target.dataset.mark)
                // Reload all annotations
                window.abwa.contentAnnotator.updateAllAnnotations((err, annotations) => {
                  if (err) {
                    console.error('Unexpected error when updating annotations')
                  } else {
                    window.abwa.contentAnnotator.redrawAnnotations()
                  }
                })
                // If no annotations are found, create one for in page level with selected tags
                if (annotations.length === 0) {
                  Alerts.confirmAlert({
                    title: chrome.i18n.getMessage('noEvidencesFoundForMarkingTitle'),
                    text: chrome.i18n.getMessage('noEvidencesFoundForMarkingText', event.target.dataset.mark),
                    alertType: Alerts.alertType.warning,
                    callback: (err) => {
                      if (err) {
                        // Manage error
                        window.alert('Unable to create alert for: noEvidencesFoundForMarking. Reload the page, and if the error continues please contact administrator.')
                      } else {
                        const TextAnnotator = require('./contentAnnotators/TextAnnotator')
                        window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(TextAnnotator.constructAnnotation(null, newTagList), (err, annotation) => {
                          if (err) {
                            Alerts.errorAlert({text: err.message})
                          } else {
                            annotations.push(annotation)
                            // Send event of mark
                            LanguageUtils.dispatchCustomEvent(Events.mark, {criteria: tagGroup.config.name, mark: event.target.dataset.mark, annotations: annotations})
                          }
                        })
                      }
                    }
                  })
                } else {
                  // Send event of mark
                  LanguageUtils.dispatchCustomEvent(Events.mark, {criteria: tagGroup.config.name, mark: event.target.dataset.mark, annotations: annotations})
                }
              }
            })
        }
      })
      this.tagsContainer.marking.append(panel)
    }
  }

  createTagsButtonsForViewing () {
    this.viewingInterval = setInterval(() => {
      // Wait until current annotations are loaded
      if (window.abwa.contentAnnotator &&
        window.abwa.contentAnnotator.currentAnnotations &&
        window.abwa.contentAnnotator.currentAnnotations.length > 0) {
        // Create viewing annotations
        this.createViewingAnnotations()
        clearInterval(this.viewingInterval)
      }
    }, 1000)
  }

  createViewingAnnotations () {
    let currentAnnotations = window.abwa.contentAnnotator.currentAnnotations
    let tags = CircularJSON.parse(CircularJSON.stringify(this.currentTags))
    // Get tag groups for each annotation
    let tagGroups = _.uniq(_.map(currentAnnotations, (annotation) => {
      return _.find(tags, (tagGroup) => {
        return tagGroup.config.name === annotation.tags[0].replace('exam:isCriteriaOf:', '')
      })
    }))
    // Remove tagGroups elements which are not the mark for the current student
    _.forEach(tagGroups, (tagGroup) => {
      _.remove(tagGroup.tags, (tag) => {
        return _.find(currentAnnotations, (annotation) => {
          let criteriaTag = _.find(annotation.tags, (annoTag) => {
            return annoTag.includes('exam:isCriteriaOf:')
          }).replace('exam:isCriteriaOf:', '')
          let markTag = _.find(annotation.tags, (annoTag) => {
            return annoTag.includes('exam:mark:')
          })
          if (markTag) {
            markTag = markTag.replace('exam:mark:', '')
            return tag.name !== markTag && tag.group.config.name === criteriaTag
          } else {
            return tag.group.config.name === criteriaTag
          }
        })
      })
    })
    // Instance as class prototype
    for (let i = 0; i < tagGroups.length; i++) {
      tagGroups[i] = new TagGroup(tagGroups[i].config, tagGroups[i].tags)
      for (let j = 0; j < tagGroups[i].tags.length; j++) {
        tagGroups[i].tags[j] = Tag.getInstance(tagGroups[i].tags[j], tagGroups[i])
      }
    }
    // Create buttons with qualifications
    for (let i = 0; i < tagGroups.length; i++) {
      let tagGroup = tagGroups[i]
      let panel = this.createGroupedButtons({
        name: tagGroup.config.name,
        color: tagGroup.config.color,
        elements: tagGroup.tags,
        buttonHandler: (event) => {
          window.abwa.contentAnnotator.goToFirstAnnotationOfTag('exam:isCriteriaOf:' + tagGroup.config.name)
        }
      })
      this.tagsContainer.viewing.append(panel)
    }
  }

  createButton ({name, color = 'white', description, handler, role}) {
    let tagButtonTemplate = document.querySelector('#tagButtonTemplate')
    let tagButton = $(tagButtonTemplate.content.firstElementChild).clone().get(0)
    tagButton.innerText = name
    if (description) {
      tagButton.title = name + ': ' + description
    } else {
      tagButton.title = name
    }
    tagButton.dataset.mark = name
    tagButton.setAttribute('role', role || 'annotation')
    if (color) {
      $(tagButton).css('background-color', color)
    }
    // Set handler for button
    tagButton.addEventListener('click', handler)
    return tagButton
  }

  createGroupedButtons ({name, color = 'white', elements, groupHandler, buttonHandler}) {
    // Create the container
    let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
    let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
    let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
    let groupNameSpan = tagGroup.querySelector('.groupName')
    groupNameSpan.innerText = name
    groupNameSpan.title = name
    // Create event handler for tag group
    groupNameSpan.addEventListener('click', groupHandler)
    // Create buttons and add to the container
    if (elements.length > 0) { // Only create group containers for groups which have elements
      for (let i = 0; i < elements.length; i++) {
        let element = elements[i]
        let button = this.createButton({
          name: element.name,
          color: element.getColor(),
          description: (element.options.description || null),
          handler: buttonHandler,
          role: 'marking'
        })
        tagButtonContainer.append(button)
      }
    }
    return tagGroup
  }

  initEventHandlers (callback) {
    // For mode change
    this.events.modeChange = {
      element: document,
      event: Events.modeChanged,
      handler: (event) => { this.modeChangeHandler(event) }
    }
    this.events.modeChange.element.addEventListener(this.events.modeChange.event, this.events.modeChange.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  modeChangeHandler (event) {
    if (event.detail.mode === ModeManager.modes.evidencing) {
      this.showEvidencingTagsContainer()
    } else if (event.detail.mode === ModeManager.modes.mark) {
      this.showMarkingTagsContainer()
    } else if (event.detail.mode === ModeManager.modes.view) {
      this.showViewingTagsContainer()
    }
  }

  showEvidencingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'true')
    $(this.tagsContainer.marking).attr('aria-hidden', 'true')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'false')
  }

  showMarkingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'true')
    $(this.tagsContainer.marking).attr('aria-hidden', 'false')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'true')
  }

  showViewingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'false')
    $(this.tagsContainer.marking).attr('aria-hidden', 'true')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'true')
  }

  /**
   * Given a no grouped tag container reorder giving a specific order for that
   * @param order
   * @param container
   */
  reorderNoGroupedTagContainer (order, container) {
    // Reorder marking container
    for (let i = order.length - 1; i >= 0; i--) {
      let criteria = order[i]
      let tagButton = _.find(container.querySelectorAll('.tagButton'), (elem) => { return elem.title === criteria })
      let elem = $(tagButton).detach()
      $(container).prepend(elem)
    }
  }

  /**
   * Given a grouped tag container reorder the groups giving a specific order
   * @param order
   * @param container
   */
  reorderGroupedTagContainer (order, container) {
    // Reorder marking container
    for (let i = order.length - 1; i >= 0; i--) {
      let criteria = order[i]
      let tagGroup = _.find(container.querySelectorAll('.tagGroup'), (elem) => { return elem.children[0].title === criteria })
      let elem = $(tagGroup).detach()
      $(container).prepend(elem)
    }
  }

  getFilteringTagList () {
    return _.map(this.currentTags, (tagGroup) => {
      return this.getTagFromGroup(tagGroup)
    })
  }

  getTagFromGroup (tagGroup) {
    return this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name
  }

  findAnnotationTagInstance (annotation) {
    let groupTag = this.getGroupFromAnnotation(annotation)
    if (annotation.tags.length > 1) {
      // Check if has code defined, because other tags can be presented (like exam:studentId:X)
      if (this.hasCodeAnnotation(annotation)) {
        return this.getCodeFromAnnotation(annotation, groupTag)
      } else {
        return groupTag
      }
    } else {
      return groupTag
    }
  }

  getGroupFromAnnotation (annotation) {
    let tags = annotation.tags
    let criteriaTag = _.find(tags, (tag) => {
      return tag.includes('exam:isCriteriaOf:')
    }).replace('exam:isCriteriaOf:')
    return _.find(window.abwa.tagManager.currentTags, (tagGroupInstance) => {
      return criteriaTag.includes(tagGroupInstance.config.name)
    })
  }

  getCodeFromAnnotation (annotation, groupTag) {
    let markTag = _.find(annotation.tags, (tag) => {
      return tag.includes('exam:mark:')
    }).replace('exam:mark:')
    return _.find(groupTag.tags, (tagInstance) => {
      return markTag.includes(tagInstance.name)
    })
  }

  hasCodeAnnotation (annotation) {
    return _.some(annotation.tags, (tag) => {
      return tag.includes('exam:mark:')
    })
  }
}

module.exports = TagManager
