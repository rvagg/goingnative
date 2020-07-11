const fs = require('fs')
const path = require('path')
const gyp = require('node-gyp')
const yaml = require('js-yaml')
const is = require('core-util-is')

// invoke `node-gyp rebuild` programatically, runs clean;configure;build
function rebuild (dir, _callback) {
  const cwd = process.cwd()
  const gypInst = gyp()

  const callback = function (err) {
    _callback(err)
  }

  gypInst.parseArgv([null, null, 'rebuild', '--loglevel', 'silent'])
  process.chdir(dir)
  gypInst.commands.clean([], function (err) {
    if (err) return callback(new Error('node-gyp clean: ' + err.message))
    gypInst.commands.configure([], function (err) {
      if (err) return callback(new Error('node-gyp configure: ' + err.message))
      gypInst.commands.build([], function (err) {
        if (err) return callback(new Error('node-gyp build: ' + err.message))

        process.chdir(cwd)
        return callback()
      })
    })
  })
}

// check binding.gyp to see if it's parsable YAML and contains the
// basic structure that we need for this to work
function checkBinding (mode, callback) {
  const exercise = this

  function fail (msg) {
    exercise.emit('fail', msg)
    return callback(null, false)
  }

  fs.readFile(path.join(exercise.submission, 'binding.gyp'), 'utf8', function (err, data) {
    if (err) return fail('Read binding.gyp (' + err.message + ')')

    let doc

    try {
      doc = yaml.safeLoad(data)
    } catch (e) {
      return fail('Parse binding.gyp (' + e.message + ')')
    }

    if (!is.isObject(doc)) {
      return fail('binding.gyp does not contain a parent object ({ ... })')
    }

    if (!is.isArray(doc.targets)) {
      return fail('binding.gyp does not contain a targets array ({ targets: [ ... ] })')
    }

    if (!is.isString(doc.targets[0].target_name)) {
      return fail('binding.gyp does not contain a target_name for the first target')
    }

    if (doc.targets[0].target_name !== 'myaddon') {
      return fail('binding.gyp does not name the first target "myaddon"')
    }

    exercise.emit('pass', 'binding.gyp includes a "myaddon" target')

    if (!is.isArray(doc.targets[0].sources)) {
      return fail('binding.gyp does not contain a sources array for the first target (sources: [ ... ])')
    }

    if (!doc.targets[0].sources.some(function (s) { return s === 'myaddon.cc' })) {
      return fail('binding.gyp does not list "myaddon.cc" in the sources array for the first target')
    }

    exercise.emit('pass', 'binding.gyp includes "myaddon.cc" as a source file')

    if (!exercise.skipBindingIncludeDirs) {
      if (!is.isArray(doc.targets[0].include_dirs)) {
        return fail('binding.gyp does not contain a include_dirs array for the first target (include_dirs: [ ... ])')
      }

      const nanConstruct = '<!(node -e "require(\'nan\')")'
      // TODO: grep the source for this string to make sure it's got `"` style quotes

      if (!doc.targets[0].include_dirs.some(function (s) { return s === nanConstruct })) {
        return fail('binding.gyp does not list NAN properly in the include_dirs array for the first target')
      }

      exercise.emit('pass', 'binding.gyp includes a correct NAN include statement')
    }

    callback(null, true)
  })
}

module.exports.rebuild = rebuild
module.exports.checkBinding = checkBinding
