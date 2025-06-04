import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {makeCombinedReducers, useCombinedReducer} from 'sentry/utils/useCombinedReducer';

describe('makeCombinedReducers', () => {
  it('calls reducer only with subset of state', () => {
    const mockFirstReducer = jest.fn();

    const reducer = makeCombinedReducers({first: mockFirstReducer, second: jest.fn()});
    reducer({first: 'first', second: ''}, 'action');

    expect(mockFirstReducer).toHaveBeenCalledWith('first', 'action');
  });

  it('calls all reducers with action', () => {
    const mockFirstReducer = jest.fn();
    const mockSecondReducer = jest.fn();

    const reducer = makeCombinedReducers({
      first: mockFirstReducer,
      second: mockSecondReducer,
    });
    reducer({first: 'first', second: 'second'}, 'action');

    expect(mockFirstReducer).toHaveBeenCalledWith('first', 'action');
    expect(mockSecondReducer).toHaveBeenCalledWith('second', 'action');
  });
});

describe('useCombinedReducer', () => {
  it('initializes with init state', () => {
    const {result} = renderHook(
      (args: Parameters<typeof useCombinedReducer>) =>
        useCombinedReducer(args[0], args[1]),
      {initialProps: [{first: jest.fn()}, {first: 'initial'}]}
    );

    expect(result.current[0]).toEqual({first: 'initial'});
  });

  it('updates state', () => {
    const {result} = renderHook(
      (args: Parameters<typeof useCombinedReducer>) =>
        useCombinedReducer(args[0], args[1]),
      {initialProps: [{first: (state, action) => state + action}, {first: 'initial'}]}
    );

    act(() => result.current[1]('_action'));
    expect(result.current[0]).toEqual({first: 'initial_action'});
  });
  it('doesnt keep old state around', () => {
    const {result} = renderHook(
      (args: Parameters<typeof useCombinedReducer>) =>
        useCombinedReducer(args[0], args[1]),
      {initialProps: [{first: (state, action) => state + action}, {first: 'initial'}]}
    );

    act(() => result.current[1]('_action'));
    act(() => result.current[1]('_action'));
    expect(result.current[0]).toEqual({first: 'initial_action_action'});
  });
});
