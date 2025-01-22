import type {StoreDefinition} from 'reflux';
import {createStore} from 'reflux';

import type {HookName, Hooks} from 'sentry/types/hooks';

interface Internals {
  // XXX(epurkhiser): We could type this as {[H in HookName]?:
  // Array<Hooks[H]>}, however this causes typescript to produce a complex
  // union that it complains is 'too complex'
  hooks: any;
}
// TODO: Make generic and match against a map of allowed callbacks if we expand this pattern.
type HookCallback = (...args: any[]) => void;

interface HookStoreDefinition extends StoreDefinition, Internals {
  add<H extends HookName>(hookName: H, callback: Hooks[H]): void;
  get<H extends HookName>(hookName: H): Hooks[H][];
  getCallback<H extends HookName>(hookName: H, key: string): HookCallback | undefined;
  init(): void;
  persistCallback<H extends HookName>(
    hookName: H,
    key: string,
    value: HookCallback
  ): void;
  remove<H extends HookName>(hookName: H, callback: Hooks[H]): void;
}

const storeConfig: HookStoreDefinition = {
  hooks: {},
  hookCallbacks: {},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.hooks = {};
    this.hookCallbacks = {}; // For persisting hook pure functions / useX react hooks remotely.
  },

  add(hookName, callback) {
    if (this.hooks[hookName] === undefined) {
      this.hooks[hookName] = [];
    }

    this.hooks[hookName].push(callback);
    this.trigger(hookName, this.hooks[hookName]);
  },

  remove(hookName, callback) {
    if (this.hooks[hookName] === undefined) {
      return;
    }
    this.hooks[hookName] = this.hooks[hookName]!.filter((cb: any) => cb !== callback);
    this.trigger(hookName, this.hooks[hookName]);
  },

  get(hookName) {
    return this.hooks[hookName]! || [];
  },

  persistCallback(hookName, key, value) {
    if (this.hookCallbacks[hookName] === undefined) {
      this.hookCallbacks[hookName] = {};
    }
    if (this.hookCallbacks[hookName][key] !== value) {
      this.hookCallbacks[hookName][key] = value;
    }
  },

  getCallback(hookName, key) {
    return this.hookCallbacks[hookName]?.[key];
  },
};

/**
 * HookStore is used to allow extensibility into Sentry's frontend via
 * registration of 'hook functions'.
 *
 * This functionality is primarily used by the SASS sentry.io product.
 */

const HookStore = createStore(storeConfig);
export default HookStore;
