var gulp = require('gulp');
var nodemon = require('gulp-nodemon');
var jasmine = require('gulp-jasmine');

gulp.task('default', ['serve']);

gulp.task('serve', function () {
  nodemon({
    watch: ['src/**/*.js'],
    script: 'src/index.js'
  });
});

gulp.task('test', function() {
  return gulp.src('spec/*_spec.js')
    .pipe(jasmine());
});
