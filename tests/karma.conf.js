// Karma configuration
// Generated on Sat Jul 26 2014 13:49:45 GMT+0200 (CEST)
var path = require('path');
var webpack = require("webpack");

var appPrefix = path.join(__dirname, "../src/sentry/static/sentry/app");

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '../',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai', 'sinon'],

    // list of files / patterns to load in the browser
    files: [
      'node_modules/babel-core/browser-polyfill.min.js',
      'tests/tests.webpack.js'
    ],

    webpack: {
      cache: true,
      resolve: {
        alias: {
          "app": appPrefix,
          "react-router": path.join(__dirname, "..", "node_modules", "react-router", "build", "lib")
        },
        modulesDirectories: ["node_modules"],
        extensions: ["", ".jsx", ".js", ".json"]
      },
      module: {
        loaders: [
          {
            exclude: /(vendor|node_modules)/,
            test: /\.jsx?$/,
            loader: "babel-loader"
          },
          {
            test: /\.json$/,
            loader: "json-loader"
          }
        ]
      },
      devtool: 'inline-source-map',
      plugins: [
        new webpack.ProvidePlugin({
          $: 'jquery',
          jQuery: 'jquery',
          "window.jQuery": "jquery",
          "root.jQuery": "jquery"
        })
      ],
    },

    webpackMiddleware: {
      noInfo: true
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
      'tests/tests.webpack.js': ['webpack', 'sourcemap']
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['dots'],

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
    // browsers: ['PhantomJS'],
    browsers: ['PhantomJS'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false
  });
};
