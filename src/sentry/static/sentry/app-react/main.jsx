/*** @jsx React.DOM */

// these get exported to a global variable, which is important as its the only
// way we can call into scoped objects
module.exports = {
  jQuery: require("jquery"),
  Raven: require("raven-js"),
  React: require("react"),

  Stream: require("./components/stream")
};
