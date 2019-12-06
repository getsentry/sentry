import Reflux from 'reflux';
import isUndefined from 'lodash/isUndefined';
import * as Sentry from '@sentry/browser';

import {Hooks, HookName} from 'app/types/hooks';

/**
 * See types/hooks for hook usage reference.
 */
const validHookNames = new Set<HookName>([
  '_',
  'analytics:event',
  'analytics:init-user',
  'analytics:track-adhoc-event',
  'analytics:track-event',
  'analytics:log-experiment',
  'component:header-date-range',
  'component:header-selector-items',
  'feature-disabled:custom-inbound-filters',
  'feature-disabled:custom-symbol-sources',
  'feature-disabled:data-forwarding',
  'feature-disabled:discard-groups',
  'feature-disabled:discover-page',
  'feature-disabled:discover-sidebar-item',
  'feature-disabled:events-page',
  'feature-disabled:events-sidebar-item',
  'feature-disabled:project-selector-checkbox',
  'feature-disabled:rate-limits',
  'feature-disabled:sso-basic',
  'feature-disabled:sso-rippling',
  'feature-disabled:sso-saml2',
  'footer',
  'integrations:feature-gates',
  'member-invite-modal:customization',
  'metrics:event',
  'onboarding:extra-chrome',
  'onboarding:invite-members',
  'organization:header',
  'routes',
  'routes:admin',
  'routes:organization',
  'routes:organization-root',
  'settings:organization-navigation',
  'settings:organization-navigation-config',
  'sidebar:bottom-items',
  'sidebar:help-menu',
  'sidebar:item-label',
  'sidebar:organization-dropdown-menu',
]);

type HookStoreInterface = {
  // XXX(epurkhiser): We could type this as {[H in HookName]?:
  // Array<Hooks[H]>}, however this causes typescript to produce a complex
  // union that it complains is 'too complex'
  hooks: any;

  add<H extends HookName>(hookName: H, callback: Hooks[H]): void;
  remove<H extends HookName>(hookName: H, callback: Hooks[H]): void;
  get<H extends HookName>(hookName: H): Array<Hooks[H]>;
};

const hookStoreConfig: Reflux.StoreDefinition & HookStoreInterface = {
  hooks: {},

  init() {
    this.hooks = {};
  },

  add(hookName, callback) {
    // Gracefully error on invalid hooks, but maintain registration
    // TODO(ts): With typescript we can rmeove this in the future
    if (!validHookNames.has(hookName)) {
      // eslint-disable-next-line no-console
      console.error('Invalid hook name: ' + hookName);
      Sentry.withScope(scope => {
        scope.setExtra('hookName', hookName);
        Sentry.captureException(new Error('Invalid hook name'));
      });
    }

    if (isUndefined(this.hooks[hookName])) {
      this.hooks[hookName] = [];
    }

    this.hooks[hookName]!.push(callback);
    this.trigger(hookName, this.hooks[hookName]);
  },

  remove(hookName, callback) {
    if (isUndefined(this.hooks[hookName])) {
      return;
    }
    this.hooks[hookName] = this.hooks[hookName]!.filter(cb => {
      return cb !== callback;
    });
    this.trigger(hookName, this.hooks[hookName]);
  },

  get(hookName) {
    return this.hooks[hookName]! || [];
  },
};

type HookStore = Reflux.Store & HookStoreInterface;

/**
 * HookStore is used to allow extensibility into Sentry's frontend via
 * registration of 'hook functions'.
 *
 * This functionality is primarily used by the SASS sentry.io product.
 */
export default Reflux.createStore(hookStoreConfig) as HookStore;
