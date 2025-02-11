import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ArithmeticBuilderContext} from 'sentry/components/arithmeticBuilder/context';
import {
  Operator,
  Parenthesis,
  TokenKind,
} from 'sentry/components/arithmeticBuilder/token';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';

describe('token', function () {
  describe('ArithmeticTokenOperator', function () {
    it('renders addition operator', async function () {
      const dispatch = jest.fn();
      const tokens = tokenizeExpression('+');

      render(
        <ArithmeticBuilderContext.Provider value={{dispatch, focusOverride: null}}>
          <TokenGrid tokens={tokens} />
        </ArithmeticBuilderContext.Provider>
      );

      const operator = screen.getByTestId('icon-add');
      expect(operator).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete +'}));
      expect(dispatch).toHaveBeenCalledWith({
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPERATOR,
          operator: Operator.PLUS,
        }),
      });
    });

    it('renders subtract operator', async function () {
      const dispatch = jest.fn();
      const tokens = tokenizeExpression('-');

      render(
        <ArithmeticBuilderContext.Provider value={{dispatch, focusOverride: null}}>
          <TokenGrid tokens={tokens} />
        </ArithmeticBuilderContext.Provider>
      );

      const operator = screen.getByTestId('icon-subtract');
      expect(operator).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete -'}));
      expect(dispatch).toHaveBeenCalledWith({
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPERATOR,
          operator: Operator.MINUS,
        }),
      });
    });

    it('renders multiply operator', async function () {
      const dispatch = jest.fn();
      const tokens = tokenizeExpression('*');

      render(
        <ArithmeticBuilderContext.Provider value={{dispatch, focusOverride: null}}>
          <TokenGrid tokens={tokens} />
        </ArithmeticBuilderContext.Provider>
      );

      const operator = screen.getByTestId('icon-multiply');
      expect(operator).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete *'}));
      expect(dispatch).toHaveBeenCalledWith({
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPERATOR,
          operator: Operator.MULTIPLY,
        }),
      });
    });

    it('renders divide operator', async function () {
      const dispatch = jest.fn();
      const tokens = tokenizeExpression('/');

      render(
        <ArithmeticBuilderContext.Provider value={{dispatch, focusOverride: null}}>
          <TokenGrid tokens={tokens} />
        </ArithmeticBuilderContext.Provider>
      );

      const operator = screen.getByTestId('icon-divide');
      expect(operator).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete /'}));
      expect(dispatch).toHaveBeenCalledWith({
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPERATOR,
          operator: Operator.DIVIDE,
        }),
      });
    });
  });

  describe('ArithmeticTokenParenthesis', function () {
    it('renders left parenthesis', async function () {
      const dispatch = jest.fn();
      const tokens = tokenizeExpression('(');

      render(
        <ArithmeticBuilderContext.Provider value={{dispatch, focusOverride: null}}>
          <TokenGrid tokens={tokens} />
        </ArithmeticBuilderContext.Provider>
      );

      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'left');

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete left'}));
      expect(dispatch).toHaveBeenCalledWith({
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.PARENTHESIS,
          parenthesis: Parenthesis.OPEN,
        }),
      });
    });

    it('renders right parenthesis', async function () {
      const dispatch = jest.fn();
      const tokens = tokenizeExpression(')');

      render(
        <ArithmeticBuilderContext.Provider value={{dispatch, focusOverride: null}}>
          <TokenGrid tokens={tokens} />
        </ArithmeticBuilderContext.Provider>
      );

      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'right');

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete right'}));
      expect(dispatch).toHaveBeenCalledWith({
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.PARENTHESIS,
          parenthesis: Parenthesis.CLOSE,
        }),
      });
    });
  });
});
