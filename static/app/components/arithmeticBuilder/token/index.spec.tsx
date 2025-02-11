import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {
  TokenFreeText,
  TokenOperator,
  TokenParenthesis,
} from 'sentry/components/arithmeticBuilder/token';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';
import {
  tokenizeExpression,
  toOperator,
  toParenthesis,
} from 'sentry/components/arithmeticBuilder/tokenizer';

function k<T extends Token>(token: T): T {
  token.key = expect.any(String);
  return token;
}

function s(value: string): TokenFreeText {
  return k(new TokenFreeText(expect.any(Object), value));
}

function o(value: string): TokenOperator {
  return k(new TokenOperator(expect.any(Object), toOperator(value)));
}

function p(value: string): TokenParenthesis {
  return k(new TokenParenthesis(expect.any(Object), toParenthesis(value)));
}

describe('token', function () {
  describe('ArithmeticTokenFreeText', function () {});

  describe('ArithmeticTokenFunction', function () {});

  describe('ArithmeticTokenOperator', function () {
    it('renders addition operator', function () {
      const tokens = tokenizeExpression('+');
      expect(tokens).toEqual([s(''), o('+'), s('')]);
      render(<TokenGrid tokens={tokens} />);
      const operator = screen.getByTestId('icon-add');
      expect(operator).toBeInTheDocument();
    });

    it('renders subtract operator', function () {
      const tokens = tokenizeExpression('-');
      expect(tokens).toEqual([s(''), o('-'), s('')]);
      render(<TokenGrid tokens={tokens} />);
      const operator = screen.getByTestId('icon-subtract');
      expect(operator).toBeInTheDocument();
    });

    it('renders multiply operator', function () {
      const tokens = tokenizeExpression('*');
      expect(tokens).toEqual([s(''), o('*'), s('')]);
      render(<TokenGrid tokens={tokens} />);
      const operator = screen.getByTestId('icon-multiply');
      expect(operator).toBeInTheDocument();
    });

    it('renders divide operator', function () {
      const tokens = tokenizeExpression('/');
      expect(tokens).toEqual([s(''), o('/'), s('')]);
      render(<TokenGrid tokens={tokens} />);
      const operator = screen.getByTestId('icon-divide');
      expect(operator).toBeInTheDocument();
    });
  });

  describe('ArithmeticTokenParenthesis', function () {
    it('renders left parenthesis', function () {
      const tokens = tokenizeExpression('(');
      expect(tokens).toEqual([s(''), p('('), s('')]);
      render(<TokenGrid tokens={tokens} />);
      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'left');
    });

    it('renders right parenthesis', function () {
      const tokens = tokenizeExpression(')');
      expect(tokens).toEqual([s(''), p(')'), s('')]);
      render(<TokenGrid tokens={tokens} />);
      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'right');
    });
  });
});
