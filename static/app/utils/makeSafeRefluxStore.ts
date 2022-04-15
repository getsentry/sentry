export interface SafeStoreDefinition extends Reflux.StoreDefinition {
  unsubscribeListeners: Reflux.Subscription[];
  /**
   * Teardown a store and all it's listeners
   */
  teardown?(): void;
}
export interface SafeRefluxStore extends Reflux.Store {
  teardown(): void;
  unsubscribeListeners: Reflux.Subscription[];
}

// XXX: Teardown will call stop on any listener subscriptions
// that have been started as a consequence of listenTo calls.
export function cleanupActiveRefluxSubscriptions(
  subscriptions: Array<Reflux.Subscription>
) {
  while (subscriptions.length > 0) {
    const unsubscribeListener = subscriptions.pop();

    if (unsubscribeListener !== undefined && 'stop' in unsubscribeListener) {
      unsubscribeListener.stop();
      continue;
    }

    const stringifiedListenerType = JSON.stringify(unsubscribeListener);
    throw new Error(
      `Attempting to call ${stringifiedListenerType}. Unsubscribe listeners should only include function calls`
    );
  }
}

// XXX: Reflux will implicitly call .init on a store when it is created
// (see node_modules/reflux/dist/reflux.js L768), and because our stores
// often subscribe to .listenTo inside init calls without storing the
// cleanup functions, our subscriptions are never cleaned up. This is fine
// for production env where stores are only init once, but causes memory
// leaks in tests when we call store.init inside a beforeEach hook.
export function makeSafeRefluxStore<
  T extends SafeStoreDefinition | Reflux.StoreDefinition
>(store: T): SafeRefluxStore & T {
  // Allow for a store to pass it's own array of unsubscribeListeners, else initialize one
  const safeStore = store as unknown as SafeRefluxStore & T;
  safeStore.unsubscribeListeners = Array.isArray(safeStore.unsubscribeListeners)
    ? safeStore.unsubscribeListeners
    : [];

  // Cleanup any subscriptions that were stored
  function teardown(this: SafeRefluxStore) {
    cleanupActiveRefluxSubscriptions(this.unsubscribeListeners);
  }
  // We allow for some stores to implement their own teardown mechanism
  // in case other listeners are attached to the store (eg. browser history listeners etc)
  if (!safeStore.teardown) {
    safeStore.teardown = teardown.bind(safeStore);
  }
  return safeStore;
}
