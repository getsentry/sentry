import Reflux from 'reflux';
import _ from 'lodash';
import * as Sentry from '@sentry/browser';

const validHookNames = new Set([
  // Additional routes
  'routes',
  'routes:admin',
  'routes:organization',
  'routes:organization-root',

  // Analytics and tracking hooks
  'analytics:init-user',
  'analytics:track-event',
  'analytics:track-adhoc-event',

  // TODO(epurkhser): This is deprecated and should be replaced
  'analytics:event',

  // Operational metrics
  'metrics:event',

  // Specific component customizations
  'component:org-auth-view',
  'component:org-members-view',
  'component:header-date-range',
  'component:header-selector-items',

  // Additional settings
  'settings:organization-navigation',
  'settings:organization-navigation-config',

  // Additional interface chrome
  'footer',
  'organization:header',
  'sidebar:help-menu',
  'sidebar:organization-dropdown-menu',
  'sidebar:bottom-items',
  'sidebar:item-label',

  // Onboarding experience
  'onboarding:invite-members',
  'onboarding:extra-chrome',

  // Used to provide a component for integration features.
  'integrations:feature-gates',

  // feature-disabled:<feature-flag> hooks should return components that will
  // be rendered in place for Feature components when the feature is not
  // enabled.
  'feature-disabled:custom-inbound-filters',
  'feature-disabled:discard-groups',
  'feature-disabled:data-forwarding',
  'feature-disabled:rate-limits',
  'feature-disabled:sso-basic',
  'feature-disabled:sso-rippling',
  'feature-disabled:sso-saml2',
  'feature-disabled:events-page',
  'feature-disabled:events-sidebar-item',
  'feature-disabled:discover-page',
  'feature-disabled:discover-sidebar-item',
  'feature-disabled:project-selector-checkbox',
  'feature-disabled:custom-symbol-sources',
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
