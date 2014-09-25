var ch = require('child_process');
var path = require('path');
var gulp = require('gulp');
var mocha = require('gulp-mocha');

gulp.task('test-collections', function() {
  return gulp.src('./test/*.js')
    .pipe(mocha({
      reporter: 'spec',
      ui: 'tdd'
    }))
    .on('error', function(err) {
      console.error(err);
      process.exit(1);
    });
});

gulp.task('default', ['test-collections']);

function run() {
  if (['harmony', 'standard'].indexOf(process.argv[2]) !== -1) {
    gulp.start('default');
  } else {
    var file = __filename;
    console.log('==============================================================');
    console.log('Running standard Node.js');
    var std = ch.spawn('node', [file, 'standard'], {stdio: 'inherit'});
    std.on('close', function() {
      console.log('==============================================================');
      console.log('Running --harmony Node.js');
      var es6 = ch.spawn('node', ['--harmony', file, 'harmony'], {stdio: 'inherit'});
      es6.on('close', function() {
        console.log('All done');
        process.exit(0);
      });
    });
  }
}
run();
