/* eslint-env jasmine, browser */
/* global browser */

const HypothesisClient = require('hypothesis-api-client')

const TOKEN = process.env.HYPOTHESIS_TOKEN

const WEBSITE_URL = 'http://info.cern.ch/hypertext/WWW/TheProject.html'

let annotation = null
let hypothesisClient = new HypothesisClient(TOKEN)

describe('Popup test', function () {
  beforeAll(() => {
    browser.call(() => new Promise((resolve, reject) => {
      hypothesisClient.createNewAnnotation({
        'group': '__world__',
        'permissions': {
          'read': [
            'group:__world__'
          ]
        },
        'references': [
        ],
        'tags': [
          'test'
        ],
        'target': [
          {
            'selector':
              [
                {
                  'exact': 'give universal access to',
                  'prefix': 've aiming to ',
                  'type': 'TextQuoteSelector',
                  'suffix': 'give universal'
                }
              ]
          }
        ],
        'body': {
          'type': 'TextualBody',
          'value': 'Example',
          'format': 'text/html',
          'language': 'en'
        },
        'uri': WEBSITE_URL,
        'motivation': 'highlighting'
      }, (err, response) => {
        if (err) {
          console.error(err)
          reject(err)
        } else {
          annotation = response
          console.log('Created annotation with id: ' + annotation.id)
          browser.url(WEBSITE_URL)
          resolve()
        }
      })
    }))
  })

  it('Tool creates a popup using annotation', async function () {
    browser.call(() => new Promise((resolve, reject) => {
      hypothesisClient.fetchAnnotation(annotation.id, (err, response) => {
        if (err) {
          reject(err)
        } else {
          expect(response.uri).toBe(WEBSITE_URL)
          resolve()
        }
      })
    }))
  })

  afterAll(() => {
    browser.call(() => new Promise((resolve, reject) => {
      hypothesisClient.deleteAnnotation(annotation.id, (err) => {
        if (err) {
          reject(err)
        } else {
          console.log('Deleted annotation ' + annotation.id)
          resolve()
        }
      })
    }))
  })
})
