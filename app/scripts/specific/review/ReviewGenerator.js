const axios = require('axios')
const _ = require('lodash')
const Alerts = require('../../utils/Alerts')

class ReviewGenerator {
  init (callback) {
    // Create generator button
    let generatorWrapperURL = chrome.extension.getURL('pages/specific/review/generator.html')
    axios.get(generatorWrapperURL).then((response) => {
      document.querySelector('#groupSelectorContainer').insertAdjacentHTML('afterend', response.data)
      let imageURL = chrome.extension.getURL('/images/generator.png')
      this.container = document.querySelector('#reviewGenerator')
      this.imageElement = this.container.querySelector('#reviewGeneratorButton')
      this.imageElement.src = imageURL
      this.imageElement.title = 'Generate review'
      this.imageElement.addEventListener('click', () => {
        this.generateReview()
      })
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  generateReview () {
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    // TODO generate the review from the annotations
  }

  destroy () {

  }
}

module.exports = ReviewGenerator
