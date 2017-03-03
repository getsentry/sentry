import moment from 'moment-timezone';
import Reflux from 'reflux';
import {setLocale} from '../locale';

const ConfigStore = Reflux.createStore({
  init() {
    this.config = {};
  },

  get(key) {
    return this.config[key];
  },

  set(key, value) {
    this.config[key] = value;
    let out = {};
    out[key] = value;
    this.trigger(out);
  },

  getConfig() {
    return this.config;
  },

  loadInitialData(config) {
    config.features = new Set(config.features || []);
    this.config = config;

    // TODO(dcramer): abstract this out of ConfigStore
    if (config.user) {
      moment.tz.setDefault(config.user.options.timezone);
      setLocale(config.user.options.language || 'en');
    }

    this.trigger(config);
  }
});

export default ConfigStore;

