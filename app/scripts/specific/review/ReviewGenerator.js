const axios = require('axios')

class ReviewGenerator {
  init (callback) {
    // TODO Create generator button
    let generatorWrapperURL = chrome.extension.getURL('pages/specific/review/generator.html')
    axios.get(generatorWrapperURL, (response) => {
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
    // TODO generate the review from the annotations
  }
}

module.exports = ReviewGenerator
