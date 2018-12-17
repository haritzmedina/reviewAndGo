# Mark And Go
[![Build Status](https://travis-ci.com/haritzmedina/MarkAndGo.svg?branch=master)](https://travis-ci.com/haritzmedina/MarkAndGo)

Mark&Go is a chrome extension to allow teachers to mark digital exams and provide faster feedback using web annotations over Moodle.
Main features:
* Supports rubric-based assignment marking consuming rubrics from moodle and creating a customized color-based highlighter to annotate evidences and mark assignments in the context
* Supports feedback messages providing in context
* Automatically translates marks and comments done in the context to moodle, ready to publish feedback and marks to students.
* Students can see teacher's comments and marks for their assignments in a click.

# For End-users

End users require a [Hypothesis](https://hypothes.is/) and [Moodle](https://moodle.org/). The extension can be downloaded from [Chrome Store](https://chrome.google.com/webstore/detail/markgo/kjedcndgienemldgjpjjnhjdhfoaocfa).

# For Moodle service manager

It is required that teachers have the following functionalities enabled in their moodle instance to allow Mark&Go get and push rubrics and students' feedback and marks:
* core_grading_get_definitions
* mod_assign_save_grade
* core_enrol_get_enrolled_users

Students don't require any special permissions.

# For developers


# For contributors


## Installation

	$ npm install

## Usage

Run `$ gulp --watch` and load the `dist`-directory into chrome.

## Entryfiles (bundles)

There are two kinds of entryfiles that create bundles.

1. All js-files in the root of the `./app/scripts` directory
2. All css-,scss- and less-files in the root of the `./app/styles` directory

## Tasks

### Build

    $ gulp


| Option         | Description                                                                                                                                           |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--watch`      | Starts a livereload server and watches all assets. <br>To reload the extension on change include `livereload.js` in your bundle.                      |
| `--production` | Minifies all assets                                                                                                                                   |
| `--verbose`    | Log additional data to the console.                                                                                                                   |
| `--vendor`     | Compile the extension for different vendors (chrome, firefox, opera, edge)  Default: chrome                                                                 |
| `--sourcemaps` | Force the creation of sourcemaps. Default: !production                                                                                                |


### pack

Zips your `dist` directory and saves it in the `packages` directory.

    $ gulp pack --vendor=firefox

### Version

Increments version number of `manifest.json` and `package.json`,
commits the change to git and adds a git tag.


    $ gulp patch      // => 0.0.X

or

    $ gulp feature    // => 0.X.0

or

    $ gulp release    // => X.0.0


## Globals

The build tool also defines a variable named `process.env.NODE_ENV` in your scripts. It will be set to `development` unless you use the `--production` option.


**Example:** `./app/background.js`

```javascript
if(process.env.NODE_ENV === 'development'){
  console.log('We are in development mode!');
}
```

## Testing

To run the tests locally, it is required a Hypothesis Developer Token. You can get yours at: https://hypothes.is/account/developer
Then, create an .env file and add it with name "HYPOTHESIS_TOKEN" (without commas)




