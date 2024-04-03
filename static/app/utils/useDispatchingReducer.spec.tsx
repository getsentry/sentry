import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useDispatchingReducer} from 'sentry/utils/useDispatchingReducer';

describe('useDispatchingReducer', () => {
  it('initializes state with initializer', () => {
    const reducer = jest.fn().mockImplementation(s => s) as () => {};
    const initialState = {type: 'initial'};
    const {result} = reactHooks.renderHook(() =>
      useDispatchingReducer(reducer, initialState)
    );

    expect(result.current[0]).toBe(initialState);
  });
  it('initializes state with fn initializer arg', () => {
    const reducer = jest.fn().mockImplementation(s => s) as () => {};
    const initialState = {type: 'initial'};
    const {result} = reactHooks.renderHook(() =>
      useDispatchingReducer(reducer, {}, () => initialState)
    );

    expect(result.current[0]).toBe(initialState);
  });
  describe('action dispatching', () => {
    const reducer = jest.fn().mockImplementation((_s, action: string) => {
      switch (action) {
        case 'action':
          return {type: 'action'};
        default:
          throw new Error('unknown action');
      }
    });
    it('calls reducer and updates state', () => {
      const initialState = {type: 'initial'};
      const {result} = reactHooks.renderHook(() =>
        useDispatchingReducer(reducer, initialState)
      );

      reactHooks.act(() => result.current[1]('action'));
      expect(reducer).toHaveBeenCalledTimes(1);
      expect(result.current[0]).toEqual({type: 'action'});
    });
    it('calls before action with state and action args', () => {
      const initialState = {type: 'initial'};
      const {result} = reactHooks.renderHook(() =>
        useDispatchingReducer(reducer, initialState)
      );

      const beforeAction = jest.fn();
      result.current[2].on('before action', beforeAction);

      reactHooks.act(() => result.current[1]('action'));

      expect(beforeAction).toHaveBeenCalledTimes(1);
      expect(beforeAction).toHaveBeenCalledWith(initialState, 'action');
    });
    it('calls after action with previous, new state and action args', () => {
      const initialState = {type: 'initial'};
      const {result} = reactHooks.renderHook(() =>
        useDispatchingReducer(reducer, initialState)
      );

      const beforeNextState = jest.fn();
      result.current[2].on('before next state', beforeNextState);

      reactHooks.act(() => result.current[1]('action'));

      expect(beforeNextState).toHaveBeenCalledTimes(1);
      expect(beforeNextState).toHaveBeenCalledWith(
        initialState,
        {type: 'action'},
        'action'
      );
    });
  });
});
