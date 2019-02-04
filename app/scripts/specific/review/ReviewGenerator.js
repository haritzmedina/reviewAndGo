/* eslint-disable */

const axios = require('axios')
const _ = require('lodash')
const Alerts = require('../../utils/Alerts')
const LanguageUtils = require('../../utils/LanguageUtils')

const {Review, Mark, MajorConcern, MinorConcern, Strength, Annotation} = require('../../exporter/reviewModel.js')

const Config = require('../../Config')
const FileSaver = require('file-saver')

const Events = require('../../contentScript/Events')
const DefaultCriterias = require('./DefaultCriterias')


let swal = require('sweetalert2')

class ReviewGenerator {
  init (callback) {
    // Create generator button
    let generatorWrapperURL = chrome.extension.getURL('pages/specific/review/generator.html')
    axios.get(generatorWrapperURL).then((response) => {
      document.querySelector('#groupSelectorContainer').insertAdjacentHTML('afterend', response.data)
      this.container = document.querySelector('#reviewGenerator')
      // Set generator image and event
      let generatorImageURL = chrome.extension.getURL('/images/generator.png')
      this.generatorImage = this.container.querySelector('#reviewGeneratorButton')
      this.generatorImage.src = generatorImageURL
      this.generatorImage.addEventListener('click', () => {
        this.generateReview()
      })
      // Set delete annotations image and event
      let deleteAnnotationsImageURL = chrome.extension.getURL('/images/deleteAnnotations.png')
      this.deleteAnnotationsImage = this.container.querySelector('#deleteAnnotationsButton')
      this.deleteAnnotationsImage.src = deleteAnnotationsImageURL
      this.deleteAnnotationsImage.addEventListener('click', () => {
        this.deleteAnnotations()
      })
      // Set create canvas image and event
      let overviewImageURL = chrome.extension.getURL('/images/overview.png')
      this.overviewImage = this.container.querySelector('#overviewButton')
      this.overviewImage.src = overviewImageURL
      this.overviewImage.addEventListener('click', () => {
        this.generateCanvas()
      })
      // Set resume image and event
      let resumeImageURL = chrome.extension.getURL('/images/resume.png')
      this.resumeImage = this.container.querySelector('#resumeButton')
      this.resumeImage.src = resumeImageURL
      this.resumeImage.addEventListener('click', () => {
        this.resume()
      })
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }
  parseAnnotations (annotations){
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
      //if (criterion == null || level == null) continue
      let textQuoteSelector = null
      let highlightText = '';
      let pageNumber = null
      for (let k in annotations[a].target) {
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' }) != null) {
          textQuoteSelector = annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' })
          highlightText = textQuoteSelector.exact
        }
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}) != null){
          pageNumber = annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}).page
        }
      }
      let annotationText = annotations[a].text!==null&&annotations[a].text!=='' ? JSON.parse(annotations[a].text) : {comment:'',suggestedLiterature:[]}
      let comment = annotationText.comment !== null ? annotationText.comment : null
      let suggestedLiterature = annotationText.suggestedLiterature !== null ? annotationText.suggestedLiterature : []
      r.insertAnnotation(new Annotation(annotations[a].id,criterion,level,highlightText,pageNumber,comment,suggestedLiterature))
    }
    return r
  }
  generateReview () {
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    let review = this.parseAnnotations(window.abwa.contentAnnotator.allAnnotations)
    let report = review.toString()
    let blob = new Blob([report], {type: 'text/plain;charset=utf-8'})
    let title = window.PDFViewerApplication.baseUrl !== null ? window.PDFViewerApplication.baseUrl.split("/")[window.PDFViewerApplication.baseUrl.split("/").length-1].replace(/\.pdf/i,"") : ""
    let docTitle = 'Review report'
    if(title!=='') docTitle += ' for '+title
    FileSaver.saveAs(blob, docTitle+'.txt')
    Alerts.closeAlert()
  }
  generateCanvas () {
    window.abwa.sidebar.closeSidebar()
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    let review = this.parseAnnotations(window.abwa.contentAnnotator.allAnnotations)
    let canvasPageURL = chrome.extension.getURL('pages/specific/review/reviewCanvas.html')
    axios.get(canvasPageURL).then((response) => {
      document.body.insertAdjacentHTML('afterend', response.data)
      let canvasContainer = document.querySelector("#canvasContainer")
      document.querySelector("#canvasOverlay").addEventListener("click",function(){
        document.querySelector("#canvasOverlay").parentNode.removeChild(document.querySelector("#canvasOverlay"))
      })
      document.querySelector("#canvasContainer").addEventListener("click",function(e){
        e.stopPropagation()
      })
      document.addEventListener("keydown",function(e){
        if(e.keyCode==27&&document.querySelector("#canvasOverlay")!=null) document.querySelector("#canvasOverlay").parentNode.removeChild(document.querySelector("#canvasOverlay"))
      })

      let canvasClusters = {}
      let criteriaList = []
      DefaultCriterias.criteria.forEach((e) => {
        if(e.name=="Typos") return
        criteriaList.push(e.name)
        if(canvasClusters[e.group]==null) canvasClusters[e.group] = [e.name]
        else canvasClusters[e.group].push(e.name);
      })

      review.annotations.forEach((e) => {
        if(e.criterion=="Typos"||criteriaList.indexOf(e.criterion)!=-1) return
        if(canvasClusters["Other"]==null) canvasClusters["Other"] = [e.criterion]
        else canvasClusters["Other"].push(e.criterion)
        criteriaList.push(e.criterion)
      })

      let clusterTemplate = document.querySelector("#propertyClusterTemplate")
      let columnTemplate = document.querySelector("#clusterColumnTemplate")
      let propertyTemplate = document.querySelector("#clusterPropertyTemplate")
      let annotationTemplate = document.querySelector("#annotationTemplate")
      let clusterHeight = 100.0/Object.keys(canvasClusters).length

      let getCriterionLevel = (annotations) => {
        if(annotations.length===0) return 'emptyCluster'
        if(annotations[0].level==null||annotations[0].level=='') return 'unsorted'
        let criterionLevel = annotations[0].level
        for(let i=1;i<annotations.length;i++){
          if(annotations[i].level==null||annotations[i].level=='') return 'unsorted'
          else if(annotations[i].level!=criterionLevel) return 'unsorted'
        }
        return criterionLevel.replace(/\s/g,'')
      }

      let displayAnnotation = (annotation) => {
        let swalContent = '';
        if(annotation.highlightText!=null&&annotation.highlightText!='') swalContent += '<h2 style="text-align:left;margin-bottom:10px;">Highlight</h2><div style="text-align:justify;font-style:italic">"'+annotation.highlightText.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'"</div>'
        if(annotation.comment!=null&&annotation.comment!='') swalContent += '<h2 style="text-align:left;margin-top:10px;margin-bottom:10px;">Comment</h2><div style="text-align:justify;">'+annotation.comment.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'
        if(annotation.suggestedLiterature!=null&&annotation.suggestedLiterature.length>0) swalContent += '<h2 style="text-align:left;margin-top:10px;margin-bottom:10px;">Suggested literature</h2><div style="text-align:justify;"><ul style="padding-left:10px;">'+annotation.suggestedLiterature.map((e) => {return '<li>'+e.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</li>'}).join('')+'</ul></div>'
        swal({
          html: swalContent,
          confirmButtonText: "View in context"
        }).then((result) => {
          if(result.value){
            document.querySelector("#canvasOverlay").parentNode.removeChild(document.querySelector("#canvasOverlay"))
            window.abwa.contentAnnotator.goToAnnotation(window.abwa.contentAnnotator.allAnnotations.find((e) => {return e.id==annotation.id}))
          }
        })
      }

      for(let key in canvasClusters){
        let clusterElement = clusterTemplate.content.cloneNode(true)
        clusterElement.querySelector(".propertyCluster").style.height = clusterHeight+'%'
        clusterElement.querySelector(".clusterLabel span").innerText = key
        let clusterContainer = clusterElement.querySelector('.clusterContainer')
        let currentColumn = null
        for(let i=0;i<canvasClusters[key].length;i++){
          if(i%2==0||canvasClusters[key].length==2){
            currentColumn = columnTemplate.content.cloneNode(true)
            if(canvasClusters[key].length==1) currentColumn.querySelector('.clusterColumn').style.width = "100%"
            else if(canvasClusters[key].length==2) currentColumn.querySelector('.clusterColumn').style.width = "50%"
            else currentColumn.querySelector('.clusterColumn').style.width = parseFloat(100.0/Math.ceil(canvasClusters[key].length/2)).toString()+'%'
          }
          let clusterProperty = propertyTemplate.content.cloneNode(true)
          clusterProperty.querySelector(".propertyLabel").innerText = canvasClusters[key][i]
          if(canvasClusters[key].length==1||canvasClusters[key].length==2||(canvasClusters[key].length%2==1&&i==canvasClusters[key].length-1)) clusterProperty.querySelector(".clusterProperty").style.height = "100%"
          else clusterProperty.querySelector(".clusterProperty").style.height = "50%";
          clusterProperty.querySelector(".clusterProperty").style.width = "100%";

          let criterionAnnotations = review.annotations.filter((e) => {return e.criterion === canvasClusters[key][i]})
          if(criterionAnnotations.length==0) clusterProperty.querySelector('.propertyAnnotations').style.display = 'none'
          clusterProperty.querySelector('.clusterProperty').className += ' '+getCriterionLevel(criterionAnnotations)

          let annotationWidth = 100.0/criterionAnnotations.length
          for(let j=0;j<criterionAnnotations.length;j++){
            let annotationElement = annotationTemplate.content.cloneNode(true)
            annotationElement.querySelector('.annotation').style.width = annotationWidth+'%'
            if(criterionAnnotations[j].highlightText!=null) annotationElement.querySelector('.annotation').innerText = '"'+criterionAnnotations[j].highlightText+'"'
            if(criterionAnnotations[j].level!=null) annotationElement.querySelector('.annotation').className += ' '+criterionAnnotations[j].level.replace(/\s/g,'')
            else annotationElement.querySelector('.annotation').className += ' unsorted'
            annotationElement.querySelector('.annotation').addEventListener('click',function(){
              displayAnnotation(criterionAnnotations[j])
            })
            clusterProperty.querySelector('.propertyAnnotations').appendChild(annotationElement)
          }

          currentColumn.querySelector('.clusterColumn').appendChild(clusterProperty)
          if(i%2==1||i==canvasClusters[key].length-1||canvasClusters[key].length==2) clusterContainer.appendChild(currentColumn)
        }
        canvasContainer.appendChild(clusterElement)
      }
      Alerts.closeAlert()
    })
  }
  deleteAnnotations () {
    // Ask user if they are sure to delete it
    Alerts.confirmAlert({
      alertType: Alerts.alertType.question,
      title: chrome.i18n.getMessage('DeleteAllAnnotationsConfirmationTitle'),
      text: chrome.i18n.getMessage('DeleteAllAnnotationsConfirmationMessage'),
      callback: (err, toDelete) => {
        // It is run only when the user confirms the dialog, so delete all the annotations
        if (err) {
          // Nothing to do
        } else {
          // Dispatch delete all annotations event
          LanguageUtils.dispatchCustomEvent(Events.deleteAllAnnotations)
          // TODO Check if it is better to maintain the sidebar opened or not
          window.abwa.sidebar.openSidebar()
        }
      }
    })

  }
  resume (){
    if(window.abwa.contentAnnotator.allAnnotations.length>0) window.abwa.contentAnnotator.goToAnnotation(window.abwa.contentAnnotator.allAnnotations.reduce((max,a) => new Date(a.updated) > new Date(max.updated) ? a : max))
  }
  destroy () {

  }
}

module.exports = ReviewGenerator
