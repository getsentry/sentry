import {useReducer} from 'react';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {combinedReducers} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider';
import {makeCombinedReducers} from 'sentry/utils/useCombinedReducer';
import {
  makeUndoableReducer,
  UndoableNode,
  useUndoableReducer,
} from 'sentry/utils/useUndoableReducer';

describe('makeUndoableReducer', () => {
  it('does not overflow', () => {
    const mockFirstReducer = jest.fn().mockImplementation(v => ++v);
    const reducer = makeUndoableReducer(mockFirstReducer);

    expect(() =>
      reducer({previous: undefined, current: 0, next: undefined}, {type: 'undo'})
    ).not.toThrow();
    expect(() =>
      reducer({previous: undefined, current: 0, next: undefined}, {type: 'redo'})
    ).not.toThrow();
  });
  it('calls undo/redo if action matches', () => {
    const mockFirstReducer = jest.fn().mockImplementation(v => {
      return ++v;
    });

    const reducer = makeUndoableReducer(mockFirstReducer);

    const first: UndoableNode<number> = {
      previous: undefined,
      current: 0,
      next: undefined,
    };

    const current = {
      previous: first,
      current: 1,
      next: undefined,
    };

    first.next = current;

    expect(reducer(first, {type: 'redo'})).toEqual(current);
    expect(reducer(current, {type: 'undo'})).toEqual(first);
    expect(mockFirstReducer).not.toHaveBeenCalled();

    expect(reducer(current, 'add')).toEqual({
      previous: current,
      current: 2,
      next: undefined,
    });
    expect(mockFirstReducer).toHaveBeenLastCalledWith(current.current, 'add');
  });

  describe('useUndoableReducer', () => {
    it('initializes with init state', () => {
      const reducer = jest
        .fn()
        .mockImplementation((state: number, action: 'add' | 'subtract') =>
          action === 'add' ? state + 1 : state - 1
        );

      const {result} = reactHooks.renderHook(() => useUndoableReducer(reducer, 100));
      expect(reducer).not.toHaveBeenCalled();
      expect(result.current[0]).toEqual(100);
    });

    it('updates state', () => {
      const reducer = jest
        .fn()
        .mockImplementation((state: number, action: 'add' | 'subtract') =>
          action === 'add' ? state + 1 : state - 1
        );

      const {result} = reactHooks.renderHook(() => useUndoableReducer(reducer, 0));
      reactHooks.act(() => result.current[1]('add'));

      expect(result.current[0]).toEqual(1);
      expect(reducer).toHaveBeenNthCalledWith(1, 0, 'add');

      reactHooks.act(() => result.current[1]('add'));
      expect(result.current[0]).toEqual(2);
      expect(reducer).toHaveBeenNthCalledWith(2, 0, 'add');
    });

    it('can undo state', () => {
      const {result} = reactHooks.renderHook(() =>
        useUndoableReducer(
          jest.fn().mockImplementation(s => s + 1),
          0
        )
      );

      reactHooks.act(() => result.current[1](0));
      expect(result.current[0]).toEqual(1);

      reactHooks.act(() => result.current[1]({type: 'undo'}));
      expect(result.current[0]).toEqual(0);
    });

    it('can redo state', () => {
      const {result} = reactHooks.renderHook(() =>
        useUndoableReducer(
          jest.fn().mockImplementation(s => {
            return s + 1;
          }),
          0
        )
      );

      reactHooks.act(() => result.current[1](0)); // 0 + 1
      reactHooks.act(() => result.current[1](1)); // 1 + 1

      reactHooks.act(() => result.current[1]({type: 'undo'})); // 2 -> 1
      reactHooks.act(() => result.current[1]({type: 'undo'})); // 1 -> 0
      expect(result.current[0]).toEqual(0);

      reactHooks.act(() => result.current[1]({type: 'redo'})); // 0 -> 1
      reactHooks.act(() => result.current[1]({type: 'redo'})); // 1 -> 2
      expect(result.current[0]).toEqual(2);

      reactHooks.act(() => result.current[1]({type: 'redo'})); // 2 -> undefined
      expect(result.current[0]).toEqual(2);
    });
  });

  it('can work with primitives', () => {
    const simpleReducer = (state: number, action: {type: 'add'} | {type: 'subtract'}) => {
      if (action.type === 'add') {
        return state + 1;
      }
      return state - 1;
    };

    const {result} = reactHooks.renderHook(() =>
      useReducer(makeUndoableReducer(makeCombinedReducers({simple: simpleReducer})), {
        previous: undefined,
        current: {
          simple: 0,
        },
        next: undefined,
      })
    );

    reactHooks.act(() => result.current[1]({type: 'add'}));
    expect(result.current[0].current.simple).toBe(1);

    reactHooks.act(() => result.current[1]({type: 'undo'}));
    expect(result.current[0].current.simple).toBe(0);

    reactHooks.act(() => result.current[1]({type: 'redo'}));
    expect(result.current[0].current.simple).toBe(1);
  });

  it('can work with objects', () => {
    const {result} = reactHooks.renderHook(() =>
      useReducer(makeUndoableReducer(combinedReducers), {
        previous: undefined,
        current: {
          preferences: {
            colorCoding: 'by symbol name',
            sorting: 'call order',
            view: 'top down',
          },
          search: {
            open: false,
            index: null,
            results: null,
            query: '',
          },
        },
        next: undefined,
      })
    );

    reactHooks.act(() =>
      result.current[1]({type: 'set color coding', payload: 'by library'})
    );
    expect(result.current[0].current.preferences.colorCoding).toBe('by library');

    reactHooks.act(() => result.current[1]({type: 'undo'}));
    expect(result.current[0].current.preferences.colorCoding).toBe('by symbol name');

    reactHooks.act(() => result.current[1]({type: 'redo'}));
    expect(result.current[0].current.preferences.colorCoding).toBe('by library');
  });
});
