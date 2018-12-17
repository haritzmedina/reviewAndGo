const html2canvas = require('html2canvas')
window.html2canvas = require('html2canvas')
const FileSaver = require('file-saver')
const $ = require('jquery')
const _ = require('lodash')
const JsPDF = require('jspdf')
const Alerts = require('../../utils/Alerts')

class Screenshots {
  constructor () {
    this.container = null
    this.imageElement = null
  }

  init () {
    // TODO Create a button to screenshot
    let screenshotsWrapperURL = chrome.extension.getURL('pages/specific/exam/screenshots.html')
    $.get(screenshotsWrapperURL, (html) => {
      $('#modeWrapper').after($.parseHTML(html))
      let imageURL = chrome.extension.getURL('/images/screenshot.png')
      this.container = document.querySelector('#screenshotsBody')
      this.imageElement = this.container.querySelector('#screenshotButton')
      this.imageElement.src = imageURL
      this.imageElement.title = 'Take a screenshot'
      this.imageElement.addEventListener('click', () => {
        this.takeScreenshot()
      })
    })
  }

  takeScreenshot (callback) {
    let promise = null
    if (window.location.href.includes('drive.google.com')) {
      promise = new Promise((resolve) => {
        let element = document.querySelector('.a-b-r-La')
        if (document.querySelector('.a-b-r-La')) {
          html2canvas(element).then((canvas) => {
            resolve(canvas)
          })
        } else {
          html2canvas(document.body).then((canvas) => {
            resolve(canvas)
          })
        }
      })
    } else if (window.location.pathname === '/content/pdfjs/web/viewer.html') {
      Alerts.confirmAlert({
        alertType: Alerts.alertType.info,
        title: 'Screenshots for PDFs is a beta feature',
        text: 'This feature is currently in a development status, it can work in a unexpected way',
        callback: () => {
          Alerts.loadingAlert({
            title: 'Please hold on',
            text: 'We are creating the screenshot (<span></span> of ' + window.PDFViewerApplication.pagesCount + ')',
            timerIntervalHandler: (swal) => {
              swal.getContent().querySelector('span').textContent = window.PDFViewerApplication.page
            }
          })
          // Create pdf file
          let pdf = new JsPDF('p', 'pt', 'a4', true)
          // Go to first page
          window.PDFViewerApplication.page = 1
          // Append rubric
          window.abwa.tagManager.showViewingTagsContainer()
          html2canvas(document.querySelector('#tagsViewing')).then((rubric) => {
            window.abwa.tagManager.showEvidencingTagsContainer()
            pdf.addImage(rubric.toDataURL(), 'png', 0, 0)
          })
          // Create promises array
          let promisesData = [...Array(window.PDFViewerApplication.pagesCount).keys()].map((index) => { return {i: index} })
          // Page screenshot promise
          let takePDFPageScreenshot = (d) => {
            return new Promise((resolve, reject) => {
              // Go to page
              window.PDFViewerApplication.page = d.i + 1
              // Redraw annotations
              window.abwa.contentAnnotator.redrawAnnotations()
              setTimeout(() => {
                html2canvas(document.querySelector('.page[data-page-number="' + (d.i + 1) + '"]'), {scale: 1}).then((canvas) => {
                  resolve()
                  pdf.addPage()
                  pdf.addImage(canvas.toDataURL(), 'png', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), '', 'FAST')
                })
              }, 500)
            })
          }
          // Wait a little bit to draw annotations in first page
          setTimeout(() => {
            // Reduce promise chain
            let promiseChain = promisesData.reduce(
              (chain, d) => chain.then(() => {
                return takePDFPageScreenshot(d)
              }), Promise.resolve([])
            )
            // To execute after promise chain is finished
            promiseChain.then((canvases) => {
              Alerts.closeAlert()
              pdf.save('activity.pdf')
            })
          }, 2000)
        }
      })
    } else {
      promise = new Promise((resolve) => {
        html2canvas(document.body).then((canvas) => {
          resolve(canvas)
        })
      })
    }
    promise.then((canvas) => {
      canvas.toBlob((blob) => {
        FileSaver.saveAs(blob, 'exam.png')
      })
    })
  }

  destroy (callback) {
    $('#screenshots').remove()
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = Screenshots
