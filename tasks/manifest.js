import gulp from 'gulp'
import gulpif from 'gulp-if'
import { colors, log } from 'gulp-util'
import livereload from 'gulp-livereload'
import jsonTransform from 'gulp-json-transform'
import plumber from 'gulp-plumber'
import applyBrowserPrefixesFor from './lib/applyBrowserPrefixesFor'
import args from './lib/args'
import fs from 'fs'
import through2 from 'through2'

let manifest = () => {
  return gulp.src('app/manifest.json')
    .pipe(plumber({
      errorHandler: error => {
        if (error) {
          log('manifest:', colors.red('Invalid manifest.json'))
        }
      }
    }))
    .pipe(
      jsonTransform(
        applyBrowserPrefixesFor(args.vendor),
        2 /* whitespace */
      )
    )
    .pipe(through2.obj({}, function (chunk, enc, cb) {
      let fileContent = chunk.contents.toString(enc)
      let chromeSettingsFileContent = fs.readFileSync('app/settings/chrome-manifest.json', 'utf8')
      let manifest = JSON.parse(fileContent)
      let chromeSettings = JSON.parse(chromeSettingsFileContent)
      let bundledManifest = Object.assign(manifest, chromeSettings)
      let stringifiedManifest = JSON.stringify(bundledManifest, null, 2)
      chunk.contents = Buffer.from(stringifiedManifest)
      this.push(chunk)
      cb()
    }))
    .pipe(gulp.dest(`dist/${args.vendor}`))
    .pipe(gulpif(args.watch, livereload()))
}

gulp.task('manifest', manifest)
