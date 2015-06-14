var gulp = require('gulp');
var nodemon = require('gulp-nodemon');
var jasmine = require('gulp-jasmine');

gulp.task('default', ['serve']);

gulp.task('serve', function () {
  nodemon({
    watch: ['src/**/*.js'],
    script: 'src/example.js'
  });
});

gulp.task('test', function() {
  return gulp.src('spec/*_spec.js')
    .pipe(jasmine());
});

gulp.task('tdd', function() {
  return gulp.watch(['src/**/*.js', 'spec/**/*.js'], function() {
    return gulp.run('test');
  });
});
