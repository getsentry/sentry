/*eslint-env node*/
var path = require("path"),
    webpack = require("webpack");

var staticPrefix = "src/sentry/static/sentry",
    distPath = staticPrefix + "/dist";

var config = {
  context: path.join(__dirname, staticPrefix),
  entry: {
    "app": "app",
    "vendor": [
      "babel-core/polyfill",
      "bootstrap/js/dropdown",
      "bootstrap/js/tab",
      "bootstrap/js/tooltip",
      "bootstrap/js/alert",
      "crypto-js/md5",
      "jquery",
      "marked",
      "moment",
      "moment-timezone",
      "raven-js",
      "react/addons",
      "react-datepicker",
      "react-document-title",
      "react-router",
      "react-bootstrap",
      "reflux",
      "selectize",
      "select2",
      "flot/jquery.flot",
      "flot/jquery.flot.stack",
      "flot/jquery.flot.time",
      "flot-tooltip/jquery.flot.tooltip",
      "vendor/simple-slider/simple-slider"
    ]
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: "babel-loader",
        include: path.join(__dirname, staticPrefix),
        exclude: /(vendor|node_modules)/
      },
      {
        test: /\.json$/,
        loader: "json-loader"
      }
    ]
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin("vendor", "vendor.js"),
    new webpack.optimize.DedupePlugin(),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      "window.jQuery": "jquery",
      "root.jQuery": "jquery",
      Raven: "raven-js"
    })
  ],
  resolve: {
    alias: {
      "flot": path.join(__dirname, staticPrefix, "vendor", "jquery-flot"),
      "flot-tooltip": path.join(__dirname, staticPrefix, "vendor", "jquery-flot-tooltip"),
    },
    modulesDirectories: [path.join(__dirname, staticPrefix), "node_modules"],
    extensions: ["", ".jsx", ".js", ".json"]
  },
  output: {
    path: distPath,
    filename: "[name].js",
    libraryTarget: "var",
    library: "exports"
  },
  devtool: 'source-map'
};

module.exports = config;
