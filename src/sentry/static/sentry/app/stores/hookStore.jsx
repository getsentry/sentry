import Reflux from 'reflux';
import _ from 'lodash';

let validHookNames = new Set([
  'component:org-members-view',
  'component:org-auth-view',
  'component:releases-tab',
  'component:sample-event',
  'footer',
  'settings:organization-navigation',
  'settings:organization-navigation-config',
  'organization:header',
  'organization:sidebar',
  'routes',
  'routes:admin',
  'routes:organization',
  'issue:secondary-column',
  'amplitude:event',
  'analytics:event',
  'analytics:log-experiment',
  'sidebar:organization-dropdown-menu',
  'sidebar:help-menu',
  'integrations:feature-gates',

  // feature-disabled:<feature-flag> hooks should return components that will
  // be rendered in place for Feature components when the feature is not
  // enabled.
  'feature-disabled:discard-groups',
  'feature-disabled:data-forwarding',
  'feature-disabled:custom-inbound-filters',
  'feature-disabled:rate-limits',
]);

/**
 * HookStore is used to allow extensability into Sentry's frontend via
 * registration of 'hook functions'.
 *
 * This functionality is primarly used by the SASS sentry.io product.
 */
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
