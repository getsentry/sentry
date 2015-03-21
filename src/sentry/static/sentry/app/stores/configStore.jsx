/** @jsx React.DOM */

var Reflux = require("reflux");

var ConfigStore = Reflux.createStore({
  init() {
    this.config = {};
  },

  get(key) {
    return this.config[key];
  },

  getConfig() {
    return this.config;
  },

  loadInitialData(config) {
    this.config = config;
  }
});

module.exports = ConfigStore;
