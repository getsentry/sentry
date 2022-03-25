export interface SafeRefluxStore extends Reflux.Store {
  teardown(): void;
  unsubscribeListeners: Reflux.Subscription[];
}

export function makeSafeRefluxStore<T extends Reflux.Store>(
  store: T
): SafeRefluxStore & T {
  const originalListenTo = store.listenTo.bind(store);
  const safeStore = store as SafeRefluxStore & T;

  // Warning: We are going to be overriding instance methods here!
  // The reason we cannot create a new store and extend it is that
  // reflux throws whenever createStore() is called with a storeDefinition
  // that implements listenTo and we cannot create a clone is because
  // Reflux.createStore implicitly connects the store already and we cannot
  // disconnect that store and connect our own...
  safeStore.unsubscribeListeners = [];

  function listenTo(
    this: SafeRefluxStore,
    action: Reflux.Listenable,
    callback: (...data: any) => void
  ) {
    const unsubscribeListener = originalListenTo(action, callback);
    this.unsubscribeListeners.push(unsubscribeListener);
    return unsubscribeListener;
  }
  function teardown(this: SafeRefluxStore) {
    while (this.unsubscribeListeners.length > 0) {
      const unsubscribeListener = this.unsubscribeListeners.pop();

      if (unsubscribeListener !== undefined && 'stop' in unsubscribeListener) {
        unsubscribeListener.stop();
        return;
      }

      throw new Error(
        `Attempting to call ${JSON.stringify(
          unsubscribeListener
        )}. Unsubscribe listeners should only include function calls`
      );
    }
  }

  safeStore.listenTo = listenTo.bind(safeStore);
  safeStore.teardown = teardown.bind(safeStore);

  return safeStore;
}
