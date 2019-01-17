import Reflux from 'reflux';
import _ from 'lodash';
import * as Sentry from '@sentry/browser';

const validHookNames = new Set([
  // Additional routes
  'routes',
  'routes:admin',
  'routes:organization',
  'routes:onboarding-survey',

  // Analytics and tracking hooks
  'amplitude:event',
  'analytics:event',
  'analytics:onboarding-survey-log',

  // Operational metrics
  'metrics:event',

  // Specific component customizations
  'sidebar:onboarding-assets',
  'utils:onboarding-survey-url',
  'component:org-auth-view',
  'component:org-members-view',

  // Additional settings
  'settings:organization-navigation',
  'settings:organization-navigation-config',

  // Additional interface chrome
  'footer',
  'organization:header',
  'sidebar:help-menu',
  'sidebar:organization-dropdown-menu',

  // Used to provide a component for integration features.
  'integrations:feature-gates',

  // feature-disabled:<feature-flag> hooks should return components that will
  // be rendered in place for Feature components when the feature is not
  // enabled.
  'feature-disabled:discard-groups',
  'feature-disabled:data-forwarding',
  'feature-disabled:custom-inbound-filters',
  'feature-disabled:rate-limits',
  'feature-disabled:sso-basic',
  'feature-disabled:sso-rippling',
  'feature-disabled:sso-saml2',

  // TODO(epurkhiser): These are not used anymore and should be removed
  'organization:sidebar',
]);

/**
 * HookStore is used to allow extensibility into Sentry's frontend via
 * registration of 'hook functions'.
 *
 * This functionality is primarily used by the SASS sentry.io product.
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
      Sentry.withScope(scope => {
        scope.setExtra('hookName', hookName);
        Sentry.captureException(new Error('Invalid hook name'));
      });
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
