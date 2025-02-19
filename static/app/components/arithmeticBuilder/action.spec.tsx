import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';

describe('useArithmeticBuilderAction', function () {
  it('returns initial state', function () {
    const {result} = renderHook(
      ({initialExpression}) =>
        useArithmeticBuilderAction({
          initialExpression,
        }),
      {
        initialProps: {
          initialExpression: 'initial expression',
        },
      }
    );
    expect(result.current).toEqual({
      dispatch: expect.any(Function),
      state: {
        expression: new Expression('initial expression'),
        focusOverride: null,
      },
    });
  });

  it('resets focus override', function () {
    const expression = '( avg(span.duration) )';

    const tokens = tokenizeExpression(expression);

    const {result} = renderHook(
      ({initialExpression}) =>
        useArithmeticBuilderAction({
          initialExpression,
        }),
      {
        initialProps: {
          initialExpression: expression,
        },
      }
    );

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

  it('deletes token', function () {
    const expression = '( avg(span.duration) )';

    const tokens = tokenizeExpression(expression);

    const {result} = renderHook(
      ({initialExpression}) =>
        useArithmeticBuilderAction({
          initialExpression,
        }),
      {
        initialProps: {
          initialExpression: expression,
        },
      }
    );

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

  it('replaces token', function () {
    const expression = '( avg(span.duration) )';

    const tokens = tokenizeExpression(expression);

    const {result} = renderHook(
      ({initialExpression}) =>
        useArithmeticBuilderAction({
          initialExpression,
        }),
      {
        initialProps: {
          initialExpression: expression,
        },
      }
    );

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
