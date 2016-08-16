import Reflux from 'reflux';
import _ from 'underscore';

let validHookNames = new Set([
  'footer',
  'organization:header',
  'organization:sidebar',
  'routes',
  'routes:admin',
  'routes:organization'
]);

const HookStore = Reflux.createStore({
  init() {
    this.hooks = {};
  },

  add(hookName, callback) {
    if (!validHookNames.has(hookName)) {
      throw new Error('Invalid hook name: ' + hookName);
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
    this.hooks[hookName] = this.hooks[hookName].filter((cb) => {
      return cb !== callback;
    });
    this.trigger(hookName, this.hooks[hookName]);
  },

  get(hookName) {
    return this.hooks[hookName] || [];
  }
});

export default HookStore;

