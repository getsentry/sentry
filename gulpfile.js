"use strict";

var gulp = require("gulp"),
    gp_cached = require("gulp-cached"),
    gp_clean = require("gulp-clean"),
    gp_concat = require("gulp-concat"),
    gp_less = require("gulp-less"),
    gp_rename = require("gulp-rename"),
    gp_uglify = require("gulp-uglify"),
    gp_util = require("gulp-util");

var path = require("path");

var staticPrefix = "src/sentry/static/sentry",
    distPath = staticPrefix + "/dist";

var jsDistros = {
  "app": [
    file("scripts/core.js"),
    file("scripts/models.js"),
    file("scripts/templates.js"),
    file("scripts/utils.js"),
    file("scripts/collections.js"),
    file("scripts/charts.js"),
    file("scripts/views.js"),
    file("scripts/app.js")
  ],

  "app-legacy": [
    file("scripts/sentry.core.js"),
    file("scripts/sentry.charts.js"),
    file("scripts/sentry.stream.js"),
  ],

  "vendor-jquery": [
    vendorFile("jquery/dist/jquery.min.js"),
    file("scripts/lib/jquery.migrate.js"),

    vendorFile("jquery-flot/jquery.flot.js"),
    vendorFile("jquery-flot/jquery.flot.resize.js"),
    vendorFile("jquery-flot/jquery.flot.stack.js"),
    vendorFile("jquery-flot/jquery.flot.time.js"),
    file("scripts/lib/jquery.flot.dashes.js"),
    file("scripts/lib/jquery.flot.tooltip.js"),

    file("scripts/lib/jquery.animate-colors.js"),
    file("scripts/lib/jquery.clippy.min.js"),
    file("scripts/lib/jquery.cookie.js")
  ],

  "vendor-backbone": [
    file("scripts/lib/json2.js"),
    file("scripts/lib/underscore.js"),
    file("scripts/lib/backbone.js")
  ],

  "vendor-bootstrap": [
    vendorFile("bootstrap/js/bootstrap-transition.js"),
    vendorFile("bootstrap/js/bootstrap-alert.js"),
    vendorFile("bootstrap/js/bootstrap-button.js"),
    vendorFile("bootstrap/js/bootstrap-carousel.js"),
    vendorFile("bootstrap/js/bootstrap-collapse.js"),
    vendorFile("bootstrap/js/bootstrap-dropdown.js"),
    vendorFile("bootstrap/js/bootstrap-modal.js"),
    vendorFile("bootstrap/js/bootstrap-tooltip.js"),
    vendorFile("bootstrap/js/bootstrap-popover.js"),
    vendorFile("bootstrap/js/bootstrap-scrollspy.js"),
    vendorFile("bootstrap/js/bootstrap-tab.js"),
    vendorFile("bootstrap/js/bootstrap-typeahead.js"),
    vendorFile("bootstrap/js/bootstrap-affix.js"),
    file("scripts/lib/bootstrap-datepicker.js")
  ],

  "vendor-misc": [
    vendorFile("moment/min/moment.min.js"),
    vendorFile("simple-slider/js/simple-slider.min.js"),
    file("scripts/lib/select2/select2.js")
  ],

  "raven": [
    vendorFile("raven-js/dist/raven.min.js")
  ]
}

function file(name) {
  return path.join(__dirname, staticPrefix, name);
}

function vendorFile(name) {
  return path.join(__dirname, staticPrefix, "vendor", name);
}

function buildJsCompileTask(name, fileList) {
  // TODO(dcramer): sourcemaps
  return function(){
    return gulp.src(fileList)
      .pipe(gp_cached('js-' + name))
      .pipe(gp_concat(name + ".js"))
      .pipe(gulp.dest(distPath))
      .pipe(gp_uglify())
      .pipe(gp_rename(name + ".min.js"))
      .pipe(gulp.dest(distPath))
      .on("error", gp_util.log);
  };
}

function buildJsWatchTask(name, fileList) {
  return function(){
    return gulp.watch(fileList, ["dist:js:" + name]);
  };
};

function buildCssCompileTask(name, fileList) {
  return function(){
    gulp.src(fileList)
    .pipe(gp_cached('css-' + name))
    .pipe(gp_less({
        paths: [vendorFile("bootstrap/less")]
    }))
    .pipe(gp_concat(name))
    .pipe(gulp.dest(distPath))
    .on("error", gp_util.log);
  };
}

function buildJsDistroTasks() {
  // create a gulp task for each JS distro
  var jsDistroNames = [], compileTask, watchTask, fileList;
  for (var distroName in jsDistros) {
    fileList = jsDistros[distroName];

    compileTask = buildJsCompileTask(distroName, fileList);
    gulp.task("dist:js:" + distroName, compileTask);

    watchTask = buildJsWatchTask(distroName, fileList);
    gulp.task("watch:js:" + distroName, watchTask);

    jsDistroNames.push(distroName);
  }

  gulp.task("dist:js", jsDistroNames.map(function(n) { return "dist:js:" + n; }));

  gulp.task("watch:js", jsDistroNames.map(function(n) { return "watch:js:" + n; }));
}

gulp.task("clean", function () {
  return gulp.src(distPath, {read: false})
    .pipe(gp_clean())
    .on("error", gp_util.log);
});


gulp.task("dist:css:sentry", buildCssCompileTask("sentry.css", [file("less/sentry.less")]))

gulp.task("dist:css:wall", buildCssCompileTask("wall.css", [file("less/wall.less")]))

gulp.task("dist:css", ["dist:css:sentry", "dist:css:wall"]);

buildJsDistroTasks();

gulp.task("dist", ["dist:js", "dist:css"]);

gulp.task("watch:css:sentry", function(){
  return gulp.watch(file("less/sentry.less"), ["dist:css:sentry"]);
});

gulp.task("watch:css:wall", function(){
  return gulp.watch(file("less/wall.less"), ["dist:css:wall"]);
});

gulp.task("watch:css", ["watch:css:sentry", "watch:css:wall"]);


gulp.task("watch", ["watch:js", "watch:css"]);

gulp.task("default", ["dist"]);
