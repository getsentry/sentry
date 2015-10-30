
import Reflux from 'reflux';

let validHookNames = new Set([
  'footer',
  'organization:header',
  'organization:sidebar'
]);

const HookStore = Reflux.createStore({
  init() {
    this.hooks = {};
  },

  add(hookName, callback) {
    if (!validHookNames.has(hookName)) {
      throw new Error('Invalid hook name: ' + hookName);
    }
    if (typeof this.hooks[hookName] === 'undefined') {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(callback);
    this.trigger(hookName, [callback]);
  },

  remove(hookName, callback) {
    if (typeof this.hooks[hookName] === 'undefined') {
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

