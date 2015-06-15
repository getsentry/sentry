var path = require("path"),
    webpack = require("webpack"),
    exec = require("sync-exec");

var staticPrefix = "src/sentry/static/sentry",
    distPath = staticPrefix + "/dist";

var getExtensionData = function() {
  // TODO(dcramer): runserver needs to enforce SENTRY_CONF
  console.log("Fetching extension data for Webpack");
  var result = exec("sentry dump_webpack_extensions");
  if (result.status) {
    console.error('Unable to generate dynamic webpack config:\n' + result.stderr);
    process.exit(result.status);
  }
  return JSON.parse(result.stdout);
}

var extensionData = (
  process.env.ALLOW_EXTERNAL_DEPS === '1' ? getExtensionData() : {}
);

var config = {
  context: path.join(__dirname, staticPrefix),
  entry: {
    "app": "app",
    "vendor": [
      "bootstrap/js/dropdown",
      "bootstrap/js/tab",
      "bootstrap/js/tooltip",
      "crypto-js/md5",
      "jquery",
      "moment",
      "raven-js",
      "react/addons",
      "react-document-title",
      "react-router",
      "react-bootstrap",
      "reflux",
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
        test: /\.jsx$/,
        loader: "jsx-loader?insertPragma=React.DOM&harmony",
        include: path.join(__dirname, staticPrefix),
        exclude: /vendor/
      }
    ]
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin("vendor", distPath + "/vendor.js"),
    new webpack.optimize.UglifyJsPlugin(),
    new webpack.optimize.DedupePlugin(),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      "window.jQuery": "jquery",
      "root.jQuery": "jquery"
    })
  ],
  resolve: {
    alias: {
      "app": path.join(__dirname, staticPrefix, "app"),
      "flot": path.join(__dirname, staticPrefix, "vendor", "jquery-flot"),
      "flot-tooltip": path.join(__dirname, staticPrefix, "vendor", "jquery-flot-tooltip"),
      "vendor": path.join(__dirname, staticPrefix, "vendor")
    },
    modulesDirectories: ["node_modules"],
    extensions: ["", ".jsx", ".js", ".json"]
  },
  output: {
    filename: distPath + "/[name].js",
    libraryTarget: "var",
    library: "exports"
  },
  devtool: 'source-map'
};

// TODO(dcramer): handle paths
for (var key in extensionData.entry) {
  config.entry[key] = extensionData.entry[key];
}

module.exports = config;
