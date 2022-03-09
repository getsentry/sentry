import isUndefined from 'lodash/isUndefined';
import Reflux from 'reflux';

import {HookName, Hooks} from 'sentry/types/hooks';

type HookStoreInterface = {
  add<H extends HookName>(hookName: H, callback: Hooks[H]): void;

  get<H extends HookName>(hookName: H): Array<Hooks[H]>;
  // XXX(epurkhiser): We could type this as {[H in HookName]?:
  // Array<Hooks[H]>}, however this causes typescript to produce a complex
  // union that it complains is 'too complex'
  hooks: any;
  remove<H extends HookName>(hookName: H, callback: Hooks[H]): void;
};

const storeConfig: Reflux.StoreDefinition & HookStoreInterface = {
  hooks: {},

  init() {
    this.hooks = {};
  },

  add(hookName, callback) {
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
    this.hooks[hookName] = this.hooks[hookName]!.filter(cb => cb !== callback);
    this.trigger(hookName, this.hooks[hookName]);
  },

  get(hookName) {
    return this.hooks[hookName]! || [];
  },
};

/**
 * HookStore is used to allow extensibility into Sentry's frontend via
 * registration of 'hook functions'.
 *
 * This functionality is primarily used by the SASS sentry.io product.
 */
const HookStore = Reflux.createStore(storeConfig) as Reflux.Store & HookStoreInterface;

export default HookStore;
