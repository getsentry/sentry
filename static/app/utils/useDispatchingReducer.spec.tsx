import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {makeCombinedReducers} from 'sentry/utils/useCombinedReducer';
import {useDispatchingReducer} from 'sentry/utils/useDispatchingReducer';

describe('useDispatchingReducer', () => {
  beforeEach(() => {
    window.requestAnimationFrame = jest.fn().mockImplementation(cb => {
      return setTimeout(cb, 0);
    });
    window.cancelAnimationFrame = jest.fn().mockImplementation(id => {
      return clearTimeout(id);
    });
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it('initializes state with initializer', () => {
    const reducer = jest.fn().mockImplementation(s => s) as () => {};
    const initialState = {type: 'initial'};
    const {result} = renderHook(() => useDispatchingReducer(reducer, initialState));

    expect(result.current[0]).toBe(initialState);
  });
  it('initializes state with fn initializer arg', () => {
    const reducer = jest.fn().mockImplementation(s => s) as () => {};
    const initialState = {type: 'initial'};
    const {result} = renderHook(() =>
      // @ts-expect-error force undfined
      useDispatchingReducer(reducer, undefined, () => initialState)
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
    it('calls reducer and updates state', async () => {
      const initialState = {type: 'initial'};
      const {result} = renderHook(() => useDispatchingReducer(reducer, initialState));

      act(() => result.current[1]('action'));
      act(() => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(reducer).toHaveBeenCalledTimes(1);
      });
      expect(result.current[0]).toEqual({type: 'action'});
    });
    it('calls before action with state and action args', () => {
      const initialState = {type: 'initial'};
      const {result} = renderHook(() => useDispatchingReducer(reducer, initialState));

      const beforeAction = jest.fn();
      result.current[2].on('before action', beforeAction);

      act(() => result.current[1]('action'));
      act(() => {
        jest.runAllTimers();
      });

      expect(beforeAction).toHaveBeenCalledTimes(1);
      expect(beforeAction).toHaveBeenCalledWith(initialState, 'action');
    });
    it('calls after action with previous, new state and action args', () => {
      const initialState = {type: 'initial'};
      const {result} = renderHook(() => useDispatchingReducer(reducer, initialState));

      const beforeNextState = jest.fn();
      result.current[2].on('before next state', beforeNextState);

      act(() => result.current[1]('action'));
      act(() => {
        jest.runAllTimers();
      });

      expect(beforeNextState).toHaveBeenCalledTimes(1);
      expect(beforeNextState).toHaveBeenCalledWith(
        initialState,
        {type: 'action'},
        'action'
      );
    });

    it('updates to final state if multiple calls', () => {
      const initialState = {};
      const action_storing_reducer = jest
        .fn()
        .mockImplementation((state, action: string) => {
          switch (action) {
            default:
              return {
                ...state,
                [action]: 1,
              };
          }
        });
      const {result} = renderHook(() =>
        useDispatchingReducer(action_storing_reducer, initialState)
      );

      act(() => {
        result.current[1]('action');
        result.current[1]('another');
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(result.current[0]).toEqual({action: 1, another: 1});
    });
  });

  it('supports combined reducer', () => {
    function reducerA(state: Record<any, any>, action: string) {
      if (action !== 'a') {
        return state;
      }
      return {...state, [action]: 1};
    }
    function reducerB(state: Record<any, any>, action: string) {
      if (action !== 'b') {
        return state;
      }
      return {...state, [action]: 1};
    }

    const finalReducer = makeCombinedReducers({
      a: reducerA,
      b: reducerB,
    });

    const initialState = {a: {}, b: {}};
    const {result} = renderHook(() => useDispatchingReducer(finalReducer, initialState));

    act(() => {
      result.current[1]('a');
      result.current[1]('b');
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current[0]).toEqual({a: {a: 1}, b: {b: 1}});
  });

  it('emitter supports side effect dispatching', () => {
    const reducer = jest.fn().mockImplementation(function reducer(
      state: Record<any, any>,
      action: string
    ) {
      const nextState = {...state, [action]: 1};
      return nextState;
    });

    const initialState = {};
    const {result} = renderHook(() => useDispatchingReducer(reducer, initialState));

    result.current[2].on('before action', (_state, action) => {
      if (action === 'a') {
        result.current[1]('b');
      }
    });

    act(() => result.current[1]('a'));
    act(() => {
      jest.runAllTimers();
    });

    expect(reducer).toHaveBeenCalledTimes(2);
  });
});
