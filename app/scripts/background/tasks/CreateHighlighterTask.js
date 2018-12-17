const Task = require('./Task')
const _ = require('lodash')
const HypothesisClientManager = require('../../hypothesis/HypothesisClientManager')
const Rubric = require('../../model/Rubric')
const CryptoUtils = require('../../utils/CryptoUtils')

class CreateHighlighterTask extends Task {
  constructor (config) {
    super()
    this.config = config
  }

  init (callback) {
    let promisesData = []
    for (let i = 0; i < this.config.activities.length; i++) {
      let rubric = this.config.activities[i].data.rubric
      let student = this.config.activities[i].data.student
      let siteUrl = new URL(rubric.moodleEndpoint)
      let courseId = this.config.activities[i].data.courseId
      let groupName = siteUrl.host + courseId + student.id
      // We create a hash using the course ID and the student ID to anonymize the Hypothes.is group
      let hashedGroupName = 'MG' + CryptoUtils.hash(groupName).substring(0, 23)
      promisesData.push({rubric, groupName: hashedGroupName})
    }

    let runPromiseToGenerateHypothesisGroup = (d) => {
      return new Promise((resolve, reject) => {
        this.generateHypothesisGroup({
          rubric: d.rubric,
          groupName: d.groupName,
          callback: (err, result) => {
            if (err) {
              reject(err)
            } else {
              if (result && result.nothingDone) {
                resolve()
              } else {
                setTimeout(resolve, 5000)
              }
            }
          }})
      })
    }

    let promiseChain = promisesData.reduce(
      (chain, d) =>
        chain.then(() => runPromiseToGenerateHypothesisGroup(d)), Promise.resolve()
    )

    promiseChain.then(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  generateHypothesisGroup ({rubric, groupName, callback}) {
    if (_.isFunction(callback)) {
      this.initHypothesisClient(() => {
        // Create hypothesis group
        this.hypothesisClientManager.hypothesisClient.getUserProfile((err, userProfile) => {
          if (_.isFunction(callback)) {
            if (err) {
              console.error(err)
              callback(err)
            } else {
              let group = _.find(userProfile.groups, (group) => {
                return group.name === groupName
              })
              if (_.isEmpty(group)) {
                this.createHypothesisGroup({name: groupName}, (err, group) => {
                  if (err) {
                    console.error('ErrorConfiguringHighlighter')
                    callback(new Error(chrome.i18n.getMessage('ErrorConfiguringHighlighter') + '<br/>' + chrome.i18n.getMessage('ContactAdministrator')))
                  } else {
                    this.createHighlighterAnnotations({
                      rubric, group, userProfile
                    }, () => {
                      callback(null)
                    })
                  }
                })
              } else {
                // TODO Check if highlighter for assignment is already created
                this.hypothesisClientManager.hypothesisClient.searchAnnotations({
                  group: group.id,
                  any: '"exam:cmid:' + rubric.cmid + '"',
                  limit: 1
                }, (err, annotations) => {
                  if (err) {
                    callback(err)
                  } else {
                    if (annotations.length > 0) {
                      console.log('Group already created')
                      callback(null, {nothingDone: true})
                    } else {
                      this.createHighlighterAnnotations({
                        rubric, group, userProfile
                      }, () => {
                        callback(null)
                      })
                    }
                  }
                })
              }
            }
          }
        })
      })
    }
  }

  createHighlighterAnnotations ({rubric, group, userProfile}, callback) {
    // Generate group annotations
    rubric.hypothesisGroup = group
    rubric = Rubric.createRubricFromObject(rubric) // convert to rubric to be able to run toAnnotations() function
    let annotations = rubric.toAnnotations()
    console.log(annotations)
    this.createTeacherAnnotation({teacherId: userProfile.userid, hypothesisGroup: group}, (err) => {
      if (err) {
        callback(new Error(chrome.i18n.getMessage('ErrorRelatingMoodleAndTool') + '<br/>' + chrome.i18n.getMessage('ContactAdministrator')))
      } else {
        // Create annotations in hypothesis
        this.hypothesisClientManager.hypothesisClient.createNewAnnotations(annotations, (err, createdAnnotations) => {
          if (err) {
            callback(new Error(chrome.i18n.getMessage('ErrorConfiguringHighlighter') + '<br/>' + chrome.i18n.getMessage('ContactAdministrator')))
          } else {
            console.debug('Group created')
            callback(null)
          }
        })
      }
    })
  }

  createHypothesisGroup ({name, assignmentName = '', student = ''}, callback) {
    this.hypothesisClientManager.hypothesisClient.createNewGroup({
      name: name, description: 'A Mark&Go generated group to mark the assignment in moodle called ' + assignmentName}, (err, group) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (_.isFunction(callback)) {
          callback(null, group)
        }
      }
    })
  }

  createTeacherAnnotation ({teacherId, hypothesisGroup}, callback) {
    let teacherAnnotation = this.generateTeacherAnnotation(teacherId, hypothesisGroup)
    this.hypothesisClientManager.hypothesisClient.createNewAnnotation(teacherAnnotation, (err, annotation) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        console.debug('Created teacher annotation: ')
        console.debug(annotation)
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  generateTeacherAnnotation (teacherId, hypothesisGroup) {
    return {
      group: hypothesisGroup.id,
      permissions: {
        read: ['group:' + hypothesisGroup.id]
      },
      references: [],
      tags: ['exam:teacher'],
      target: [],
      text: 'teacherId: ' + teacherId,
      uri: hypothesisGroup.links ? hypothesisGroup.links.html : hypothesisGroup.url // Compatibility with both group representations getGroups and userProfile
    }
  }

  initHypothesisClient (callback) {
    this.hypothesisClientManager = new HypothesisClientManager()
    this.hypothesisClientManager.init(() => {
      this.hypothesisClientManager.logInHypothesis((err, hypothesisToken) => {
        if (_.isFunction(callback)) {
          if (err) {
            callback(err)
          } else {
            callback(null)
          }
        }
      })
    })
  }
}

module.exports = CreateHighlighterTask
