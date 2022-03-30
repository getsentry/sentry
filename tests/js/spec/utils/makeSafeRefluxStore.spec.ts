import {Listenable, createStore, createAction} from 'reflux';

import {makeSafeRefluxStore, SafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

describe('makeSafeRefluxStore', () => {
  it('cleans up listeners on teardown', () => {
    const safeStore = createStore(makeSafeRefluxStore({})) as unknown as SafeRefluxStore;

    const statusUpdateAction = createAction({'status update': ''});
    safeStore.unsubscribeListeners.push(
      safeStore.listenTo(statusUpdateAction, () => null)
    );

    // @ts-ignore idk why this thinks it's a never type
    const stopListenerSpy = jest.spyOn(safeStore.unsubscribeListeners[0], 'stop');

    safeStore.teardown();

    expect(stopListenerSpy).toHaveBeenCalled();
    expect(safeStore.unsubscribeListeners).toHaveLength(0);
  });

  it('does not override unsubscribeListeners', () => {
    const stop = jest.fn();
    const subscription = {stop, listenable: {} as unknown as Listenable};

    const safeStore = createStore(
      makeSafeRefluxStore({
        unsubscribeListeners: [subscription],
      })
    ) as unknown as SafeRefluxStore;

    expect(safeStore.unsubscribeListeners[0]).toBe(subscription);
  });

  it('tears down subscriptions', () => {
    const stop = jest.fn();
    const subscription = {stop, listenable: {} as unknown as Listenable};

    const safeStore = createStore(
      makeSafeRefluxStore({
        unsubscribeListeners: [subscription],
      })
    ) as unknown as SafeRefluxStore;

    safeStore.teardown();

    expect(stop).toHaveBeenCalled();
    expect(safeStore.unsubscribeListeners.length).toBe(0);
  });

  it('allows for custom tear down implementation', () => {
    const teardown = jest.fn();
    const subscription = {
      stop: jest.fn(),
      listenable: {} as unknown as Listenable,
    };

    const safeStore = createStore(
      makeSafeRefluxStore({
        unsubscribeListeners: [subscription],
        teardown: function () {
          teardown();
        },
      })
    ) as unknown as SafeRefluxStore;

    safeStore.teardown();

    expect(teardown).toHaveBeenCalled();
    expect(safeStore.unsubscribeListeners[0]).toBe(subscription);
  });
});
