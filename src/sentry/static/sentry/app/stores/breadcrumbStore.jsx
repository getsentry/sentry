/** @jsx React.DOM */

var Reflux = require("reflux");

var BreadcrumbStore = Reflux.createStore({
  init() {
    this.nodes = [];
  },

  push(node) {
    this.nodes.push(node);
    this.trigger();
  },

  pop() {
    this.nodes.pop();
    this.trigger();
  },

  getNodes() {
    return this.nodes;
  }
});

module.exports = BreadcrumbStore;
