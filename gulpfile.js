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

gulp.task('default', ['test-collections'], function() {
  console.log('All done');
});

gulp.start('default');
