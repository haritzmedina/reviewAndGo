const Events = require('../../contentScript/Events')
const MoodleClientManager = require('../../moodle/MoodleClientManager')
const MoodleUtils = require('../../moodle/MoodleUtils')
const _ = require('lodash')
const Alerts = require('../../utils/Alerts')
const AnnotationUtils = require('../../utils/AnnotationUtils')

class MoodleGradingManager {
  constructor () {
    this.moodleClientManager = null
    this.events = {}
  }

  init (callback) {
    this.moodleClientManager = new MoodleClientManager(window.abwa.rubricManager.rubric.moodleEndpoint)
    this.moodleClientManager.init(() => {
      // Create event for marking
      this.events.marking = {
        element: document,
        event: Events.mark,
        handler: this.markAnnotationCreateEventHandler((err) => {
          if (err) {
            Alerts.errorAlert({text: err.message})
          } else {
            Alerts.temporalAlert({text: 'The mark is updated in moodle', title: 'Correctly marked', type: Alerts.alertType.success})
          }
        })
      }
      this.events.marking.element.addEventListener(this.events.marking.event, this.events.marking.handler, false)
      // Create event for comment update
      this.events.comment = {
        element: document,
        event: Events.comment,
        handler: this.markAnnotationCreateEventHandler()
      }
      this.events.comment.element.addEventListener(this.events.comment.event, this.events.comment.handler, false)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  markAnnotationCreateEventHandler (callback) {
    return (event) => {
      let annotation = null
      if (_.has(event.detail, 'annotations[0]')) {
        annotation = event.detail.annotations[0]
      } else {
        annotation = event.detail.annotation
      }
      this.updateAnnotationsFromOtherFiles(annotation, (err, annotations) => {
        if (err) {

        } else {
          // Get student id
          let studentId = window.abwa.contentTypeManager.fileMetadata.studentId
          // Get assignmentId from rubric
          let cmid = window.abwa.rubricManager.rubric.cmid
          // Get all annotations for current cmid
          window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
            any: 'exam:cmid:' + cmid,
            group: window.abwa.groupSelector.currentGroup.id,
            user: window.abwa.groupSelector.user.userid
          }, (err, annotations) => {
            if (err) {

            } else {
              // Filter from search only the annotations which are used to classify and are from this cmid
              let cmid = window.abwa.rubricManager.rubric.cmid
              annotations = _.filter(annotations, (anno) => {
                return anno.uri !== window.abwa.groupSelector.currentGroup.links.html &&
                  _.find(anno.tags, (tag) => {
                    return tag === 'exam:cmid:' + cmid
                  })
              })
              let marks = _.map(annotations, (annotation) => {
                let criteriaName = _.find(annotation.tags, (tag) => {
                  return tag.includes('exam:isCriteriaOf:')
                }).replace('exam:isCriteriaOf:', '')
                let levelName = _.find(annotation.tags, (tag) => {
                  return tag.includes('exam:mark:')
                })
                if (levelName) {
                  levelName = levelName.replace('exam:mark:', '')
                } else {
                  levelName = null
                }
                let url = MoodleUtils.createURLForAnnotation({annotation, studentId, courseId: window.abwa.rubricManager.rubric.courseId, cmid: window.abwa.rubricManager.rubric.cmid})
                // Construct feedback
                let text = annotation.text
                let feedbackCommentElement = ''
                if (text) {
                  let quoteSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
                  if (quoteSelector) {
                    feedbackCommentElement = '<b>' + text + '</b><br/><a href="' + url + '">See in context</a>'
                  }
                }
                return {criteriaName, levelName, text, url, feedbackCommentElement}
              })
              // Get for each criteria name and mark its corresponding criterionId and level from window.abwa.rubric
              let criterionAndLevels = this.getCriterionAndLevel(marks)
              let feedbackComment = this.getFeedbackComment(marks)
              // Compose moodle data
              let moodleGradingData = this.composeMoodleGradingData({
                criterionAndLevels,
                userId: studentId,
                assignmentId: window.abwa.rubricManager.rubric.assignmentId,
                feedbackComment: feedbackComment
              })
              // Update student grading in moodle
              this.moodleClientManager.updateStudentGradeWithRubric(moodleGradingData, (err) => {
                if (err) {
                  if (_.isFunction(callback)) {
                    callback(new Error('Error when updating moodle'))
                  }
                } else {
                  if (_.isFunction(callback)) {
                    callback(null)
                  }
                }
              })
            }
          })
        }
      })
    }
  }

  getCriterionAndLevel (marks) {
    let rubric = window.abwa.rubricManager.rubric
    let criterionAndLevel = []
    for (let i = 0; i < marks.length; i++) {
      let mark = marks[i]
      let criteria = _.find(rubric.criterias, (criteria) => {
        return criteria.name === mark.criteriaName
      })
      let level = _.find(criteria.levels, (level) => {
        return level.name === mark.levelName
      })
      if (_.isUndefined(level)) {
        level = {levelId: -1}
      }
      let remark = mark.text
      criterionAndLevel.push({criterionId: criteria.criteriaId, levelid: level.levelId, remark})
    }
    let resultingMarks = {}
    // TODO Append links if shared
    // Merge remarks with same criterionId and append remark
    _.forEach(criterionAndLevel, (crit) => {
      let remark = _.has(resultingMarks[crit.criterionId], 'remark') ? resultingMarks[crit.criterionId]['remark'] + '\n\n' + crit.remark : crit.remark
      let levelid = crit.levelid
      resultingMarks[crit.criterionId] = {remark: remark, levelid: levelid}
    })
    // Convert merge object to an array
    return _.map(resultingMarks, (mark, key) => { return {criterionId: key, levelid: mark.levelid, remark: mark.remark} })
  }

  getFeedbackComment (marks) {
    let feedbackComment = '<h1>How to see feedback in your assignment?</h1><ul>' +
      '<li><a target="_blank" href="https://chrome.google.com/webstore/detail/markgo/kjedcndgienemldgjpjjnhjdhfoaocfa">Install Mark&Go</a></li>' +
      '<li><a target="_blank" href="' + window.abwa.groupSelector.currentGroup.links.html + '">Join feedback group</a></li>' +
      '</ul><hr/>' // TODO i18n
    let groupedMarksArray = _.values(_.groupBy(marks, 'criteriaName'))
    _.forEach(groupedMarksArray, (markGroup) => {
      // Criteria + level
      let criteria = markGroup[0].criteriaName
      let levelId = markGroup[0].levelName
      feedbackComment += '<h2>Criteria: ' + criteria + ' - Mark: ' + levelId + '</h2><br/>'
      // Comments
      _.forEach(markGroup, (mark) => {
        feedbackComment += mark.feedbackCommentElement + '<br/>'
      })
      // hr
      feedbackComment += '<hr/>'
    })
    return feedbackComment
  }

  composeMoodleGradingData ({criterionAndLevels, userId, assignmentId, feedbackComment}) {
    let rubric = {criteria: []}
    for (let i = 0; i < criterionAndLevels.length; i++) {
      let criterionAndLevel = criterionAndLevels[i]
      if (criterionAndLevel.levelid > -1) { // If it is -1, the student is not grade for this criteria
        rubric.criteria.push({
          'criterionid': criterionAndLevel.criterionId,
          'fillings': [
            {
              'criterionid': '0',
              'levelid': criterionAndLevel.levelid,
              'remark': criterionAndLevel.remark,
              'remarkformat': 1
            }
          ]
        })
      }
    }
    return {
      'userid': userId + '',
      'assignmentid': assignmentId,
      'attemptnumber': '0',
      'addattempt': 1,
      'workflowstate': '',
      'applytoall': 1,
      'grade': '0',
      'advancedgradingdata': { rubric: rubric },
      'plugindata': {
        'assignfeedbackcomments_editor': {
          'format': '1', // HTML
          'text': feedbackComment
        }
      }
    }
  }

  destroy (callback) {
    // Remove the event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  updateAnnotationsFromOtherFiles (annotation, callback) {
    // Get all annotations with same criteria and student
    let criteria = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
    let mark = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:mark:')
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      tags: 'exam:isCriteriaOf:' + criteria,
      group: window.abwa.groupSelector.currentGroup.id
    }, (err, oldTagsAnnotations) => {
      if (err) {

      } else {
        let cmid = window.abwa.rubricManager.rubric.cmid
        // Filter only the ones which are not configuration annotations and are for this cmid
        oldTagsAnnotations = _.filter(oldTagsAnnotations, (anno) => {
          return anno.uri !== window.abwa.groupSelector.currentGroup.links.html &&
            _.find(anno.tags, (tag) => {
              return tag === 'exam:cmid:' + cmid
            })
        })
        let promises = []
        for (let i = 0; i < oldTagsAnnotations.length; i++) {
          let oldTagAnnotation = oldTagsAnnotations[i]
          promises.push(new Promise((resolve, reject) => {
            oldTagAnnotation.tags = ['exam:isCriteriaOf:' + criteria, 'exam:mark:' + mark, 'exam:cmid:' + cmid]
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
    })
  }
}

module.exports = MoodleGradingManager
