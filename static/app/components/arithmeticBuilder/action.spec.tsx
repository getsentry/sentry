import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
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
        expression: 'initial expression',
        focusOverride: null,
        tokens: expect.any(Array),
        validated: 'invalid',
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
        expression: '( sum(span.duration) )',
        focusOverride: {
          itemKey: 'foo',
        },
        tokens: expect.any(Array),
        validated: 'valid',
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
        expression: '( sum(span.duration) )',
        focusOverride: null,
        tokens: expect.any(Array),
        validated: 'valid',
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
        expression: '( )',
        focusOverride: null,
        tokens: expect.any(Array),
        validated: 'invalid',
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
        expression: '( sum(span.duration) )',
        focusOverride: null,
        tokens: expect.any(Array),
        validated: 'valid',
      },
    });
  });
});
