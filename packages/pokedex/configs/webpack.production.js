const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = (env) => ({
  devtool: false,
  output: {
    filename: "js/[name].[contenthash:8].chunk.js",
    chunkFilename: "js/[name].[contenthash:8].lazy-chunk.js",
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "css/[name].[contenthash:8].chunk.css",
      chunkFilename: "css/[name].[contenthash:8].lazy-chunk.css",
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: "all",
    },
  },

  module: {
    rules: [
      {
        test: /\.(scss|css)$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
      },
    ],
  },
});
