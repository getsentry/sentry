import {useReducer} from 'react';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {makeCombinedReducers} from 'sentry/utils/useCombinedReducer';
import type {UndoableNode} from 'sentry/utils/useUndoableReducer';
import {makeUndoableReducer, useUndoableReducer} from 'sentry/utils/useUndoableReducer';

describe('makeUndoableReducer', () => {
  it('does not overflow undo/redo', () => {
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

      const {result} = renderHook(
        (args: Parameters<typeof useUndoableReducer>) =>
          useUndoableReducer(args[0], args[1]),
        {
          initialProps: [reducer, 100],
        }
      );
      expect(reducer).not.toHaveBeenCalled();
      expect(result.current[0]).toBe(100);
    });

    it('updates state', () => {
      const reducer = jest
        .fn()
        .mockImplementation((state: number, action: 'add' | 'subtract') =>
          action === 'add' ? state + 1 : state - 1
        );

      const {result} = renderHook(
        (args: Parameters<typeof useUndoableReducer>) =>
          useUndoableReducer(args[0], args[1]),
        {initialProps: [reducer, 0]}
      );
      act(() => result.current[1]('add'));

      expect(result.current[0]).toBe(1);
      expect(reducer).toHaveBeenNthCalledWith(1, 0, 'add');

      act(() => result.current[1]('add'));
      expect(result.current[0]).toBe(2);
      // TODO(react18): switch back to .toHaveBeenNthCalledWith(2, 1, 'add');
      expect(reducer).toHaveBeenLastCalledWith(1, 'add');
    });

    it('can undo state', () => {
      const {result} = renderHook(
        (args: Parameters<typeof useUndoableReducer>) =>
          useUndoableReducer(args[0], args[1]),
        {initialProps: [jest.fn().mockImplementation(s => s + 1), 0]}
      );

      act(() => result.current[1](0));
      expect(result.current[0]).toBe(1);

      act(() => result.current[1]({type: 'undo'}));
      expect(result.current[0]).toBe(0);
    });

    it('can redo state', () => {
      const {result} = renderHook(
        (args: Parameters<typeof useUndoableReducer>) =>
          useUndoableReducer(args[0], args[1]),
        {initialProps: [jest.fn().mockImplementation(s => s + 1), 0]}
      );

      act(() => result.current[1](0)); // 0 + 1
      act(() => result.current[1](1)); // 1 + 1

      act(() => result.current[1]({type: 'undo'})); // 2 -> 1
      act(() => result.current[1]({type: 'undo'})); // 1 -> 0
      expect(result.current[0]).toBe(0);

      act(() => result.current[1]({type: 'redo'})); // 0 -> 1
      act(() => result.current[1]({type: 'redo'})); // 1 -> 2
      expect(result.current[0]).toBe(2);

      act(() => result.current[1]({type: 'redo'})); // 2 -> undefined
      expect(result.current[0]).toBe(2);
    });
  });

  it('can peek previous and next state', () => {
    const simpleReducer = (state, action) =>
      action.type === 'add' ? state + 1 : state - 1;

    const {result} = renderHook(
      (args: Parameters<typeof useUndoableReducer>) =>
        useUndoableReducer(args[0], args[1]),
      {
        initialProps: [simpleReducer, 0],
      }
    );

    act(() => result.current[1]({type: 'add'}));
    expect(result.current?.[2].previousState).toBe(0);

    act(() => result.current[1]({type: 'undo'}));
    expect(result.current?.[2].nextState).toBe(1);
  });

  it('can work with primitives', () => {
    const simpleReducer = (state: number, action: {type: 'add'} | {type: 'subtract'}) =>
      action.type === 'add' ? state + 1 : state - 1;

    const {result} = renderHook(
      (args: Parameters<typeof useReducer>) => useReducer(args[0], args[1]),
      {
        initialProps: [
          makeUndoableReducer(makeCombinedReducers({simple: simpleReducer})),
          {
            previous: undefined,
            current: {
              simple: 0,
            },
            next: undefined,
          },
        ],
      }
    );

    act(() => result.current[1]({type: 'add'}));
    expect(result.current[0].current.simple).toBe(1);

    act(() => result.current[1]({type: 'undo'}));
    expect(result.current[0].current.simple).toBe(0);

    act(() => result.current[1]({type: 'redo'}));
    expect(result.current[0].current.simple).toBe(1);
  });

  it('can work with objects', () => {
    const combinedReducers = makeCombinedReducers({
      math: (state: number, action: {type: 'add'} | {type: 'subtract'}) =>
        action.type === 'add' ? state + 1 : state - 1,
    });
    const {result} = renderHook(
      (args: Parameters<typeof useReducer>) => useReducer(args[0], args[1]),
      {
        initialProps: [
          makeUndoableReducer(combinedReducers),
          {
            previous: undefined,
            current: {
              math: 0,
            },
            next: undefined,
          },
        ],
      }
    );

    act(() => result.current[1]({type: 'add'}));
    expect(result.current[0].current.math).toBe(1);

    act(() => result.current[1]({type: 'undo'}));
    expect(result.current[0].current.math).toBe(0);

    act(() => result.current[1]({type: 'redo'}));
    expect(result.current[0].current.math).toBe(1);
  });
});
