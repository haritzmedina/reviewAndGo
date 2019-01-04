/* eslint-disable */

const axios = require('axios')
const _ = require('lodash')
const Alerts = require('../../utils/Alerts')

const {Review, Mark, MajorConcern, MinorConcern, Strength, Annotation} = require('../../exporter/reviewModel.js')

const Config = require('../../Config')
const FileSaver = require('file-saver')

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
  parseAnnotations (annotations) {
    const criterionTag = Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':'
    const levelTag = Config.review.namespace + ':' + Config.review.tags.grouped.subgroup + ':'
    const majorConcernLevel = 'Major concern'
    const minorConcernLevel = 'Minor concern'
    const strengthLevel = 'Strength'
    let r = new Review()

    for (let a in annotations) {
      let criterion = null
      let level = null
      for (let t in annotations[a].tags) {
        if (annotations[a].tags[t].indexOf(criterionTag) != -1) criterion = annotations[a].tags[t].replace(criterionTag, '').trim()
        if (annotations[a].tags[t].indexOf(levelTag) != -1) level = annotations[a].tags[t].replace(levelTag, '').trim()
      }
      if (criterion == null || level == null) continue
      let textQuoteSelector = null
      let pageNumber = null
      for (let k in annotations[a].target) {
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' }) != null) {
          textQuoteSelector = annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' })
        }
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}) != null){
          pageNumber = annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}).page
        }
      }
      switch (level) {
        case majorConcernLevel:
          let mc = r.majorConcerns.find((m) => { return m.criterion === criterion })
          if (mc == null) {
            let m
            if (textQuoteSelector != null) {
              m = new MajorConcern(criterion, null)
              let w = new Annotation(textQuoteSelector.exact, pageNumber, annotations[a].text)
              m.inserAnnotation(w)
            } else {
              m = new MajorConcern(criterion, annotations[a].text)
            }
            r.insertMajorConcern(m)
          } else {
            if (textQuoteSelector != null) {
              let w = new Annotation(textQuoteSelector.exact, pageNumber, annotations[a].text)
              mc.inserAnnotation(w)
            }
          }
          break
        case minorConcernLevel:
          let minC = r.minorConcerns.find((m) => { return m.criterion === criterion })
          if (minC == null) {
            let m
            if (textQuoteSelector !== null) {
              m = new MinorConcern(criterion, null)
              let w = new Annotation(textQuoteSelector.exact, pageNumber, annotations[a].text)
              m.inserAnnotation(w)
            } else {
              m = new MinorConcern(criterion, annotations[a].text)
            }
            r.insertMinorConcern(m)
          } else {
            if (textQuoteSelector !== null) {
              let w = new Annotation(textQuoteSelector.exact, pageNumber, annotations[a].text)
              minC.inserAnnotation(w)
            }
          }
          break
        case strengthLevel:
          let st = r.strengths.find((m) => { return m.criterion === criterion })
          if (st == null) {
            let m
            if (textQuoteSelector !== null) {
              m = new Strength(criterion, null)
              let w = new Annotation(textQuoteSelector.exact, pageNumber, annotations[a].text)
              m.inserAnnotation(w)
            } else {
              m = new Strength(criterion, annotations[a].text)
            }
            r.insertStrength(m)
          } else {
            if (textQuoteSelector !== null) {
              let w = new Annotation(textQuoteSelector.exact, pageNumber, annotations[a].text)
              st.inserAnnotation(w)
            }
          }
          break
        default:
          break
      }
    }
    return r
  }
  generateReview () {
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    let review = this.parseAnnotations(window.abwa.contentAnnotator.allAnnotations)
    let report = review.toString()
    let blob = new Blob([report], {type: 'text/plain;charset=utf-8'})
    FileSaver.saveAs(blob, 'reviewReport.txt')
    Alerts.closeAlert()
  }

  destroy () {

  }
}

module.exports = ReviewGenerator
