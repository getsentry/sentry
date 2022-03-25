import Reflux from 'reflux';

import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

describe('makeSafeRefluxStore', () => {
  it('calls original listenTo', () => {
    const store = Reflux.createStore({});
    const safeStore = makeSafeRefluxStore(store);

    const statusUpdateAction = Reflux.createAction({'status update': ''});
    const storeListenToSpy = jest.spyOn(store, 'listenTo');

    safeStore.listenTo(statusUpdateAction, () => null);

    expect(storeListenToSpy).toHaveBeenCalledTimes(1);
  });

  it('stores listener', () => {
    const safeStore = makeSafeRefluxStore(Reflux.createStore({}));

    const statusUpdateAction = Reflux.createAction({'status update': ''});
    safeStore.listenTo(statusUpdateAction, () => null);

    expect(safeStore.unsubscribeListeners).toHaveLength(1);
  });

  it('cleans up listeners on teardown', () => {
    const safeStore = makeSafeRefluxStore(Reflux.createStore({}));

    const statusUpdateAction = Reflux.createAction({'status update': ''});
    safeStore.listenTo(statusUpdateAction, () => null);

    // @ts-ignore idk why this thinks it's a never type
    const stopListenerSpy = jest.spyOn(safeStore.unsubscribeListeners[0], 'stop');

    safeStore.teardown();

    expect(stopListenerSpy).toHaveBeenCalled();
    expect(safeStore.unsubscribeListeners).toHaveLength(0);
  });
});
