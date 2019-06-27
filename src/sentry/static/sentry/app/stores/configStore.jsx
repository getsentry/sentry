import moment from 'moment-timezone';
import Reflux from 'reflux';
import qs from 'query-string';
import {setLocale} from 'app/locale';

const ConfigStore = Reflux.createStore({
  init() {
    this.config = {};
  },

  get(key) {
    return this.config[key];
  },

  set(key, value) {
    this.config[key] = value;
    const out = {};
    out[key] = value;
    this.trigger(out);
  },

  getConfig() {
    return this.config;
  },

  loadInitialData(config, languageOverride = null) {
    config.features = new Set(config.features || []);
    this.config = config;

    // TODO(dcramer): abstract this out of ConfigStore
    if (config.user) {
      config.user.permissions = new Set(config.user.permissions);
      moment.tz.setDefault(config.user.options.timezone);

      let queryString = {};

      // Parse query string for `lang`
      try {
        queryString = qs.parse(window.location.search) || {};
      } catch (err) {
        // ignore if this fails to parse
        // this can happen if we have an invalid query string
        // e.g. unencoded "%"
      }

      // Priority:
      // "?lang=en" --> user configuration options --> django request.LANGUAGE_CODE --> "en"
      setLocale(
        queryString.lang || config.user.options.language || languageOverride || 'en'
      );
    } else if (languageOverride) {
      setLocale(languageOverride);
    }

    this.trigger(config);
  },
});

export default ConfigStore;
