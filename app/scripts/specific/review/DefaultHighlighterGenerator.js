const Config = require('../../Config')
const DefaultCriterias = require('./DefaultCriterias')

class DefaultHighlighterGenerator {
  static createReviewHypothesisGroup (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.createNewGroup({name: Config.review.groupName}, callback)
  }

  static createDefaultAnnotations (hypothesisGroupId, callback) {

  }
}

module.exports = DefaultHighlighterGenerator
