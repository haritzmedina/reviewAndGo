const Alerts = require('../utils/Alerts')
const FileUtils = require('../utils/FileUtils')
const LocalStorageManager = require('../storage/local/LocalStorageManager')
const FileSaver = require('file-saver')

class Options {
  init () {
    // Restore
    document.querySelector('#restoreDatabaseButton').addEventListener('click', () => {
      Alerts.inputTextAlert({
        title: 'Upload your database backup file',
        html: 'Danger zone! <br/>This operation will override current local storage database, deleting all the annotations for all your documents. Please make a backup first.',
        type: Alerts.alertType.warning,
        input: 'file',
        callback: (err, file) => {
          if (err) {
            window.alert('An unexpected error happened when trying to load the alert.')
          } else {
            // Read json file
            FileUtils.readJSONFile(file, (err, jsonObject) => {
              if (err) {
                Alerts.errorAlert({text: 'Unable to read json file: ' + err.message})
              } else {
                this.restoreDatabase(jsonObject, (err) => {
                  if (err) {
                    Alerts.errorAlert({text: 'Something went wrong when trying to restore the database'})
                  } else {
                    Alerts.successAlert({text: 'Database restored.'})
                  }
                })
              }
            })
          }
        }
      })
    })
    // Backup
    document.querySelector('#backupDatabaseButton').addEventListener('click', () => {
      this.backupDatabase()
    })
    // Delete
    document.querySelector('#deleteDatabaseButton').addEventListener('click', () => {
      Alerts.confirmAlert({
        title: 'Deleting your database',
        alertType: Alerts.alertType.warning,
        text: 'Danger zone! <br/>This operation will override current local storage database, deleting all the annotations for all your documents. Please make a backup first.',
        callback: () => {
          this.deleteDatabase((err) => {
            if (err) {
              Alerts.errorAlert({text: 'Error deleting the database, please try it again or contact developer.'})
            } else {
              Alerts.successAlert({text: 'Local storage successfully deleted'})
            }
          })
        }
      })
    })
  }

  restoreDatabase (jsonObject, callback) {
    window.options.localStorage = new LocalStorageManager()
    window.options.localStorage.init(() => {
      window.options.localStorage.saveDatabase(jsonObject, callback)
    })
  }

  backupDatabase () {
    window.options.localStorage = new LocalStorageManager()
    window.options.localStorage.init(() => {
      let stringifyObject = JSON.stringify(window.options.localStorage.annotationsDatabase, null, 2)
      // Download the file
      let blob = new window.Blob([stringifyObject], {
        type: 'text/plain;charset=utf-8'
      })
      let dateString = (new Date()).toISOString()
      FileSaver.saveAs(blob, 'reviewAndGo-databaseBackup' + dateString + '.json')
    })
  }

  deleteDatabase (callback) {
    window.options.localStorage = new LocalStorageManager()
    window.options.localStorage.init(() => {
      window.options.localStorage.cleanDatabase(callback)
    })
  }
}

module.exports = Options
