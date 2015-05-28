/** @jsx React.DOM */

var Reflux = require("reflux");

var LoadingIndicator = require('../components/loadingIndicator');

var IndicatorStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  add(node) {
    if (!React.isValidElement(node)) {
      node = <LoadingIndicator global={true}>{node}</LoadingIndicator>;
    }
    this.items.push(node);
    this.trigger(this.items);
    return node;
  },

  remove(indicator) {
    this.items = this.items.filter((item) => {
      return item !== indicator;
    });
    this.trigger(this.items);
  }
});

module.exports = IndicatorStore;
