/* eslint-disable */

const Alerts = require('../../utils/Alerts')
const Config = require('../../Config')
const {Review, Mark, MajorConcern, MinorConcern, Strength, Annotation} = require('../../exporter/reviewModel.js')

let swal = require('sweetalert2')

const ReviewAssistant = {
  parseAnnotations(annotations){
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
  },
  checkBalanced(){
    let review = this.parseAnnotations(window.abwa.contentAnnotator.allAnnotations);
    let strengthNum = review.strengths.length;
    let concernNum = review.majorConcerns.length + review.minorConcerns.length;
    if (strengthNum === 0 && concernNum > 0){
      swal({
        type: 'info',
        text: 'You should consider including strengths too.',
        toast: true,
        showConfirmButton: false,
        timer: 15000,
        position: 'bottom-end'
      })
    }
    else if (concernNum === 0 && strengthNum > 0) {
      swal({
        type: 'info',
        text: 'You should consider including concerns too.',
        toast: true,
        showConfirmButton: false,
        timer: 15000,
        position: 'bottom-end'
      })
    }
  },
  checkSelective: () => {
    return;
  }
}

module.exports = ReviewAssistant
