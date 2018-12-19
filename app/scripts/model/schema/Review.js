const AnnotationGuide = require('./AnnotationGuide')

class Review extends AnnotationGuide {
  constructor ({reviewId, hypothesisGroup}) {
    super({name: reviewId, hypothesisGroup})
    this.criterias = this.guideElements
    this.reviewId = reviewId
  }
}

module.exports = Review
