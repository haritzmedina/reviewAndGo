const AnnotationGuide = require('./AnnotationGuide')
const Criteria = require('./Criteria')
const Level = require('./Level')
const LanguageUtils = require('../../utils/LanguageUtils')
const DefaultCriterias = require('../../specific/review/DefaultCriterias')

class Review extends AnnotationGuide {
  constructor ({reviewId = '', hypothesisGroup = ''}) {
    super({name: reviewId, hypothesisGroup})
    this.criterias = this.guideElements
  }

  toAnnotations () {
    let annotations = []
    // Create annotations for all criterias
    for (let i = 0; i < this.criterias.length; i++) {
      annotations = annotations.concat(this.criterias[i].toAnnotations())
    }
    return annotations
  }

  static fromCriterias (criterias) {
    let review = new Review({reviewId: ''})
    for (let i = 0; i < criterias.length; i++) {
      let criteria = new Criteria({name: criterias[i].name, description: criterias[i].description, custom: criterias[i].custom, group: criterias[i].group, review})
      criteria.levels = []
      for (let j = 0; j < criterias[i].levels.length; j++) {
        let level = new Level({name: criterias[i].levels[j].name, criteria: criteria})
        criteria.levels.push(level)
      }
      review.criterias.push(criteria)
    }
    return review
  }

  toObject () {
    let object = {
      criteria: [],
      defaultLevels: DefaultCriterias.defaultLevels
    }
    // For each criteria create the object
    for (let i = 0; i < this.criterias.length; i++) {
      let criteria = this.criterias[i]
      if (LanguageUtils.isInstanceOf(criteria, Criteria)) {
        object.criteria.push(criteria.toObject())
      }
    }
    return object
  }
}

module.exports = Review
