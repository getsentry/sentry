import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';

describe('useArithmeticBuilderAction', () => {
  it('returns initial state', () => {
    const {result} = renderHook(useArithmeticBuilderAction, {
      initialProps: {
        initialExpression: 'initial expression',
      },
    });
    expect(result.current).toEqual({
      dispatch: expect.any(Function),
      state: {
        expression: new Expression('initial expression'),
        focusOverride: null,
      },
    });
  });

  it('resets focus override', () => {
    const expression = '( avg(span.duration) )';

    const tokens = tokenizeExpression(expression);

    const {result} = renderHook(useArithmeticBuilderAction, {
      initialProps: {
        initialExpression: expression,
      },
    });

    act(() =>
      result.current.dispatch({
        type: 'REPLACE_TOKEN',
        token: tokens[3]!,
        text: 'sum(span.duration)',
        focusOverride: {itemKey: 'foo'},
      })
    );

    expect(result.current).toEqual({
      dispatch: expect.any(Function),
      state: {
        expression: new Expression('( sum(span.duration) )'),
        focusOverride: {
          itemKey: 'foo',
        },
      },
    });

    act(() =>
      result.current.dispatch({
        type: 'RESET_FOCUS_OVERRIDE',
      })
    );

    expect(result.current).toEqual({
      dispatch: expect.any(Function),
      state: {
        expression: new Expression('( sum(span.duration) )'),
        focusOverride: null,
      },
    });
  });

  it('deletes token', () => {
    const expression = '( avg(span.duration) )';

    const tokens = tokenizeExpression(expression);

    const {result} = renderHook(useArithmeticBuilderAction, {
      initialProps: {initialExpression: expression},
    });

    act(() =>
      result.current.dispatch({
        type: 'DELETE_TOKEN',
        token: tokens[3]!,
      })
    );

    expect(result.current).toEqual({
      dispatch: expect.any(Function),
      state: {
        expression: new Expression('( )'),
        focusOverride: null,
      },
    });
  });

  it('replaces token', () => {
    const expression = '( avg(span.duration) )';

    const tokens = tokenizeExpression(expression);

    const {result} = renderHook(useArithmeticBuilderAction, {
      initialProps: {initialExpression: expression},
    });

    act(() =>
      result.current.dispatch({
        type: 'REPLACE_TOKEN',
        token: tokens[3]!,
        text: 'sum(span.duration)',
      })
    );

    expect(result.current).toEqual({
      dispatch: expect.any(Function),
      state: {
        expression: new Expression('( sum(span.duration) )'),
        focusOverride: null,
      },
    });
  });
});
