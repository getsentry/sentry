
import Reflux from "reflux";

var ConfigStore = Reflux.createStore({
  init() {
    this.config = {};
  },

  get(key) {
    return this.config[key];
  },

  set(key, value) {
    this.config[key] = value;
    var out = {};
    out[key] = value;
    this.trigger(out);
  },

  getConfig() {
    return this.config;
  },

  loadInitialData(config) {
    config.features = new Set(config.features || []);
    this.config = config;
    this.trigger(config);
  }
});

export default ConfigStore;

