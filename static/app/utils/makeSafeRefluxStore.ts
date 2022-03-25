interface SafeRefluxStore extends Reflux.Store {
  teardown(): void;
  unsubscribeListeners: Reflux.Subscription[];
}

export function makeSafeRefluxStore<T extends Reflux.Store>(
  store: T
): SafeRefluxStore & T {
  return {
    ...store,
    listenTo(action: Reflux.Listenable, callback: (...data: any) => void) {
      const unsubscribeListener = store.listenTo(action, callback);
      this.unsubscribeListeners.push(unsubscribeListener);
    },
    teardown() {
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
    },
    unsubscribeListeners: [],
  };
}
