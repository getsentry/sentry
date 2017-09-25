import Reflux from 'reflux';
import _ from 'lodash';

let validHookNames = new Set([
  'footer',
  'organization:header',
  'organization:sidebar',
  'organization:dashboard:secondary-column',
  'routes',
  'routes:admin',
  'routes:organization',
  'project:data-forwarding:disabled',
  'project:rate-limits:disabled',
  'project:custom-inbound-filters:disabled',
  'issue:secondary-column'
]);

const HookStore = Reflux.createStore({
  init() {
    this.hooks = {};
  },

  add(hookName, callback) {
    // Gracefully error on invalid hooks, but maintain registration
    if (!validHookNames.has(hookName)) {
      console.error('Invalid hook name: ' + hookName);
    }
    if (_.isUndefined(this.hooks[hookName])) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(callback);
    this.trigger(hookName, [callback]);
  },

  remove(hookName, callback) {
    if (_.isUndefined(this.hooks[hookName])) {
      return;
    }
    this.hooks[hookName] = this.hooks[hookName].filter(cb => {
      return cb !== callback;
    });
    this.trigger(hookName, this.hooks[hookName]);
  },

  get(hookName) {
    return this.hooks[hookName] || [];
  }
});

export default HookStore;
