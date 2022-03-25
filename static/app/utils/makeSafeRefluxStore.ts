export interface SafeRefluxStore extends Reflux.Store {
  teardown(): void;
  unsubscribeListeners: Reflux.Subscription[];
}

export function makeSafeRefluxStore<T extends Reflux.Store>(
  store: T
): SafeRefluxStore & T {
  const storeCopy: SafeRefluxStore & T = Object.assign(
    Object.create(Object.getPrototypeOf(store)),
    store
  );

  storeCopy.unsubscribeListeners = [];

  function listenTo(
    this: SafeRefluxStore,
    action: Reflux.Listenable,
    callback: (...data: any) => void
  ) {
    const unsubscribeListener = store.listenTo(action, callback);
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

  storeCopy.listenTo = listenTo.bind(storeCopy);
  storeCopy.teardown = teardown.bind(storeCopy);

  return storeCopy;
}
