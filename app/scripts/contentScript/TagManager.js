const _ = require('lodash')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const ModeManager = require('./ModeManager')
const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')
const Events = require('./Events')
const Tag = require('./Tag')
const TagGroup = require('./TagGroup')
const Alerts = require('../utils/Alerts')
const CircularJSON = require('circular-json-es6')
const DefaultHighlighterGenerator = require('../specific/review/DefaultHighlighterGenerator')
const DefaultCriterias = require('../specific/review/DefaultCriterias')

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
      // Check if there are tags in the group or it is needed to create the default ones
      let promise = Promise.resolve(annotations) // TODO Check if it is okay
      if (annotations.length === 0) {
        promise = new Promise((resolve) => {
          if (!Alerts.isVisible()) {
            Alerts.loadingAlert({title: 'Configuration in progress', text: 'We are configuring everything to start reviewing.', position: Alerts.position.center})
          }
          DefaultHighlighterGenerator.createDefaultAnnotations(window.abwa.groupSelector.currentGroup, (err, annotations) => {
            if (err) {
              Alerts.errorAlert({text: 'There was an error when configuring Review&Go highlighter'})
            } else {
              Alerts.closeAlert()
              resolve(annotations)
            }
          })
        })
      }
      promise.then((annotations) => {
        // Add to model
        this.model.groupAnnotations = annotations
        // Create tags based on annotations
        this.currentTags = this.createTagsBasedOnAnnotations()
        // Populate tags containers for the modes
        this.createTagsButtonsForEvidencing()
        this.createTagsButtonsForViewing()
        if (_.isFunction(callback)) {
          callback()
        }
      })
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
    // Get groups
    let tagGroupsAnnotations = {}
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag, namespace: this.model.namespace, group: this.model.config.grouped.group, options: jsYaml.load(this.model.groupAnnotations[i].text)})
      }
    }
    // Get groups names
    let groups = _.map(_.uniqBy(DefaultCriterias.criteria, (criteria) => { return criteria.group }), 'group')
    // Get a list of colors
    let colorList = ColorUtils.getDifferentColors(groups.length)
    // Set colors for each group
    let array = _.toArray(tagGroupsAnnotations)
    let colors = {}
    for (let i = 0; i < array.length; i++) {
      let tagGroup = tagGroupsAnnotations[array[i].config.name]
      let color = colorList[_.findIndex(groups, (groupName) => { return groupName === tagGroup.config.options.group })]
      colors[tagGroup.config.name] = color
      tagGroup.config.color = color
    }
    /* for (let i = 0; i < groups.length; i++) {
      colors[groups[i]] = colorList[i]
      tagGroupsAnnotations[groups[i]].config.color = colorList[i]
    } */
    // Get elements for each subgroup
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
    // Order elements from tag group
    // TODO Check if in this case is important to order elements from group
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

  collapseExpandGroupedButtonsHandler (event) {
    let tagGroup = event.target.parentElement
    if (tagGroup.getAttribute('aria-expanded') === 'true') {
      tagGroup.setAttribute('aria-expanded', 'false')
    } else {
      tagGroup.setAttribute('aria-expanded', 'true')
    }
  }

  createTagsButtonsForEvidencing () {
    let groups = _.map(_.uniqBy(DefaultCriterias.criteria, (criteria) => { return criteria.group }), 'group')
    for (let i = 0; i < groups.length; i++) {
      let group = groups[i]
      this.tagsContainer.evidencing.append(this.createGroupedButtons({name: group, groupHandler: this.collapseExpandGroupedButtonsHandler}))
    }
    // Create the group Other
    this.tagsContainer.evidencing.append(this.createGroupedButtons({name: 'Other', groupHandler: this.collapseExpandGroupedButtonsHandler}))
    // Create the default groups for annotations
    // Insert buttons in each of the groups
    let arrayOfTagGroups = _.values(this.model.currentTags)
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let button = this.createButton({
        name: tagGroup.config.name,
        color: ColorUtils.setAlphaToColor(tagGroup.config.color, 0.5),
        description: tagGroup.config.options.description,
        handler: (event) => {
          let tags = [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name
          ]
          LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: tags, chosen: event.target.dataset.chosen})
        }})
      // Insert in its corresponding group container
      this.tagsContainer.evidencing.querySelector('[title="' + tagGroup.config.options.group + '"]').nextElementSibling.append(button)
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
        return tagGroup.config.name === annotation.tags[0].replace('review:isCriteriaOf:', '')
      })
    }))
    // Remove tagGroups elements which are not the mark for the current student
    _.forEach(tagGroups, (tagGroup) => {
      _.remove(tagGroup.tags, (tag) => {
        return _.find(currentAnnotations, (annotation) => {
          let criteriaTag = _.find(annotation.tags, (annoTag) => {
            return annoTag.includes('review:isCriteriaOf:')
          }).replace('review:isCriteriaOf:', '')
          let markTag = _.find(annotation.tags, (annoTag) => {
            return annoTag.includes('review:level:')
          })
          if (markTag) {
            markTag = markTag.replace('review:level:', '')
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
          window.abwa.contentAnnotator.goToFirstAnnotationOfTag('review:isCriteriaOf:' + tagGroup.config.name)
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
    if (_.isArray(elements) && elements.length > 0) { // Only create group containers for groups which have elements
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
    // For annotation event, reload sidebar with elements chosen and not chosen ones
    this.events.annotationCreated = {
      element: document,
      event: Events.annotationCreated,
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.annotationCreated.element.addEventListener(this.events.annotationCreated.event, this.events.annotationCreated.handler, false)
    // For delete event, reload sidebar with elements chosen and not chosen ones
    this.events.annotationDeleted = {
      element: document,
      event: Events.annotationDeleted,
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.annotationDeleted.element.addEventListener(this.events.annotationDeleted.event, this.events.annotationDeleted.handler, false)
    // When annotations are reloaded
    this.events.updatedAllAnnotations = {
      element: document,
      event: Events.updatedAllAnnotations,
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.updatedAllAnnotations.element.addEventListener(this.events.updatedAllAnnotations.event, this.events.updatedAllAnnotations.handler, false)
    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  reloadTagsChosen () {
    // Uncheck all the tags
    let tagButtons = document.querySelectorAll('.tagButton')
    for (let i = 0; i < tagButtons.length; i++) {
      let tagButton = tagButtons[i]
      tagButton.dataset.chosen = 'false'
    }
    // Retrieve annotated tags
    let annotations = window.abwa.contentAnnotator.allAnnotations
    let annotatedTagGroups = []
    for (let i = 0; i < annotations.length; i++) {
      annotatedTagGroups.push(this.getGroupFromAnnotation(annotations[i]))
    }
    annotatedTagGroups = _.uniq(annotatedTagGroups)
    // Check annotated tags
    for (let i = 0; i < annotatedTagGroups.length; i++) {
      let tagGroup = annotatedTagGroups[i]
      let tagButton = this.tagsContainer.evidencing.querySelector('.tagButton[data-mark="' + tagGroup.config.name + '"]')
      tagButton.dataset.chosen = 'true'
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
      return tag.includes('review:isCriteriaOf:')
    }).replace('review:isCriteriaOf:')
    return _.find(window.abwa.tagManager.currentTags, (tagGroupInstance) => {
      return criteriaTag.includes(tagGroupInstance.config.name)
    })
  }

  getCodeFromAnnotation (annotation, groupTag) {
    let markTag = _.find(annotation.tags, (tag) => {
      return tag.includes('review:level:')
    }).replace('review:level:')
    return _.find(groupTag.tags, (tagInstance) => {
      return markTag.includes(tagInstance.name)
    })
  }

  hasCodeAnnotation (annotation) {
    return _.some(annotation.tags, (tag) => {
      return tag.includes('review:level:')
    })
  }
}

module.exports = TagManager
