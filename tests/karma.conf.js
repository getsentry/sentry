// Karma configuration
// Generated on Sat Jul 26 2014 13:49:45 GMT+0200 (CEST)
var path = require('path');

var appPrefix = path.join(__dirname, "../src/sentry/static/sentry/app");

console.log(appPrefix);

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '..',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai', 'sinon'],


    // list of files / patterns to load in the browser
    files: [
      'src/sentry/static/sentry/dist/vendor.js',
      'src/sentry/static/sentry/dist/app.js',
      'tests/js/**/*Spec.js'
    ],


    // list of files to exclude
    exclude: [
    ],

    webpack: {
      cache: true,
        module: {
        resolve: {
          alias: {
            "app": appPrefix
          },
          modulesDirectories: ["node_modules"],
          extensions: ["", ".jsx", ".js", ".json"]
        },
        loaders: [
          {
            test: /\.jsx$/,
            loader: "jsx-loader?insertPragma=React.DOM&harmony",
            include: path.join(__dirname, appPrefix),
            exclude: /vendor/
          }
        ]
      },
      devtool: 'inline-source-map',
    },

    webpackMiddleware: {
        // webpack-dev-middleware configuration
        // i. e.
        noInfo: true
    },

    webpackServer: {
      stats: {
        colors: true
      }
    },

    plugins: [
      'karma-chai',
      'karma-mocha',
      'karma-phantomjs-launcher',
      'karma-sinon',
      'karma-sourcemap-loader',
      'karma-webpack'
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'tests/**/*.js': ['webpack', 'sourcemap']
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['PhantomJS'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false
  });
};
