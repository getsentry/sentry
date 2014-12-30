"use strict";

var gulp = require("gulp"),
    gp_cached = require("gulp-cached"),
    gp_clean = require("gulp-clean"),
    gp_concat = require("gulp-concat"),
    gp_less = require("gulp-less"),
    gp_rename = require("gulp-rename"),
    gp_uglify = require("gulp-uglify"),
    gp_util = require("gulp-util"),
    gp_webpack = require("gulp-webpack");

var path = require("path");

var staticPrefix = "src/sentry/static/sentry",
    distPath = staticPrefix + "/dist";

var jsDistros = {
  // "app": [
  //   file("app/modules/charts.js"),
  //   file("app/modules/collection.js"),
  //   file("app/modules/flash.js"),
  //   file("app/modules/forms.js"),

  //   file("app/controllers/default.js"),
  //   file("app/controllers/deleteTeam.js"),
  //   file("app/controllers/editProjectRule.js"),
  //   file("app/controllers/groupDetails.js"),
  //   file("app/controllers/manageAccessGroupMembers.js"),
  //   file("app/controllers/manageAccessGroupProjects.js"),
  //   file("app/controllers/manageProject.js"),
  //   file("app/controllers/manageProjectNotifications.js"),
  //   file("app/controllers/manageTeamOwnership.js"),
  //   file("app/controllers/manageTeamSettings.js"),
  //   file("app/controllers/projectStream.js"),
  //   file("app/controllers/teamDashboard.js"),
  //   file("app/controllers/teamList.js"),

  //   file("app/directives/assigneeSelector.js"),
  //   file("app/directives/clippy.js"),
  //   file("app/directives/count.js"),
  //   file("app/directives/timeSince.js"),
  //   file("app/directives/broadcast.js"),

  //   file("app/models/group.js")
  // ],

  // "legacy-app": [
  //   file("app/init.js"),
  //   file("app/charts.js"),
  //   file("app/utils.js")
  // ],

  // "vendor-jquery": [
  //   vendorFile("jquery/dist/jquery.min.js"),
  //   file("scripts/lib/jquery.migrate.js"),

  //   vendorFile("jquery-flot/jquery.flot.js"),
  //   vendorFile("jquery-flot/jquery.flot.resize.js"),
  //   vendorFile("jquery-flot/jquery.flot.stack.js"),
  //   vendorFile("jquery-flot/jquery.flot.time.js"),
  //   file("scripts/lib/jquery.flot.dashes.js"),
  //   file("scripts/lib/jquery.flot.tooltip.js"),

  //   file("scripts/lib/jquery.cookie.js"),

  //   vendorFile("typeahead.js/dist/typeahead.jquery.min.js")
  // ],

  // "vendor-bootstrap": [
  //   vendorFile("bootstrap/dist/js/bootstrap.min.js"),
  //   vendorFile("bootstrap-datepicker/js/bootstrap-datepicker.js")
  // ],

  // "vendor-misc": [
  //   vendorFile("moment/min/moment.min.js"),
  //   vendorFile("simple-slider/js/simple-slider.min.js"),
  //   vendorFile("selectize/dist/js/standalone/selectize.min.js")
  // ],

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
    var ext = name.split('.').slice(-1);
    return gulp.src(fileList)
      .pipe(gp_cached('js-' + name))
      .pipe(gp_concat(name + "." + ext))
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

gulp.task("dist:webpack", function(){
  return gp_webpack(require('./webpack.config.js'));
});

gulp.task("dist", ["dist:js", "dist:css", "dist:webpack"]);

gulp.task("watch:css:sentry", function(){
  return gulp.watch(file("less/sentry.less"), ["dist:css:sentry"]);
});

gulp.task("watch:css:wall", function(){
  return gulp.watch(file("less/wall.less"), ["dist:css:wall"]);
});

gulp.task("watch:css", ["watch:css:sentry", "watch:css:wall"]);

gulp.task("watch:webpack", function(){
  var config = require('./webpack.config.js');
  config.watch = true;
  return gp_webpack(config);
});

gulp.task("watch", ["watch:js", "watch:css", "watch:webpack"]);

gulp.task("default", ["dist"]);
