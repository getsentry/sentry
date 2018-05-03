import Reflux from 'reflux';
import _ from 'lodash';

let validHookNames = new Set([
  'assistant:support-button',
  'component:org-members-view',
  'footer',
  'settings:organization-navigation',
  'settings:organization-navigation-config',
  'organization:header',
  'organization:sidebar',
  'routes',
  'routes:admin',
  'routes:organization',
  'project:data-forwarding:disabled',
  'project:rate-limits:disabled',
  'project:custom-inbound-filters:disabled',
  'project:discard-groups:disabled',
  'issue:secondary-column',
  'analytics:onboarding-complete',
  'analytics:event',
  'sidebar:organization-dropdown-menu',
]);

const HookStore = Reflux.createStore({
  init() {
    this.hooks = {};
  },

  add(hookName, callback) {
    // Gracefully error on invalid hooks, but maintain registration
    if (!validHookNames.has(hookName)) {
      // eslint-disable-next-line no-console
      console.error('Invalid hook name: ' + hookName);
    }
    if (_.isUndefined(this.hooks[hookName])) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(callback);
    this.trigger(hookName, this.hooks[hookName]);
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
  },
});

export default HookStore;
