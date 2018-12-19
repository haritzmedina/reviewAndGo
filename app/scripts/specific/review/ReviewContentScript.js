const _ = require('lodash')
const ReviewGenerator = require('./DefaultHighlighterGenerator')

class ReviewContentScript {
  constructor (config) {
    this.config = config
  }

  init (callback) {
    window.abwa.specific = window.abwa.specific || {}
    window.abwa.specific.reviewGenerator = new ReviewGenerator()
    window.abwa.specific.reviewGenerator.init(() => {

    })
  }

  destroy () {

  }
}

module.exports = ReviewContentScript
