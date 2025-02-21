import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {
  isTokenFreeText,
  isTokenFunction,
  isTokenOperator,
  isTokenParenthesis,
  Parenthesis,
  TokenKind,
} from 'sentry/components/arithmeticBuilder/token';
import {defined} from 'sentry/utils';

export function validateTokens(tokens: Token[]): boolean {
  const validator = new ExpressionValidator();

  for (const token of tokens) {
    if (!validator.push(token)) {
      return false;
    }
  }

  return validator.isValid();
}

export function computeNextAllowedTokenKinds(tokens: Array<Token | null>): TokenKind[][] {
  const validator = new ExpressionValidator();
  const tokenKinds = [];

  for (const token of tokens) {
    if (!defined(token)) {
      tokenKinds.push([]);
    } else if (isTokenFreeText(token)) {
      tokenKinds.push(validator.nextAllowedTokenKinds());
    } else {
      if (validator.push(token)) {
        tokenKinds.push([]);
      } else {
        tokenKinds.push([]);
        validator.force([token]);
      }
    }
  }

  return tokenKinds;
}

interface PushOptions {
  dryRun: boolean;
}

class ExpressionValidator {
  private stack: TokenKind[];

  constructor() {
    this.stack = [];
  }

  force(tokens: Token[]) {
    this.stack = tokens.map(token => token.kind);
  }

  nextAllowedTokenKinds(): TokenKind[] {
    const dryRun: PushOptions = {dryRun: true};
    const tokenKinds = [];

    if (this.pushParenthesis(Parenthesis.OPEN, dryRun)) {
      tokenKinds.push(TokenKind.OPEN_PARENTHESIS);
    }

    if (this.pushParenthesis(Parenthesis.CLOSE, dryRun)) {
      tokenKinds.push(TokenKind.CLOSE_PARENTHESIS);
    }

    if (this.pushOperator(dryRun)) {
      tokenKinds.push(TokenKind.OPERATOR);
    }

    if (this.pushExpression(dryRun)) {
      tokenKinds.push(TokenKind.FUNCTION);
    }

    return tokenKinds;
  }

  push(token: Token): boolean {
    const options: PushOptions = {dryRun: false};

    if (isTokenFunction(token)) {
      return this.pushExpression(options);
    }

    if (isTokenFreeText(token)) {
      return this.pushFreeText(token.text, options);
    }

    if (isTokenOperator(token)) {
      return this.pushOperator(options);
    }

    if (isTokenParenthesis(token)) {
      return this.pushParenthesis(token.parenthesis, options);
    }

    return false;
  }

  pushExpression({dryRun}: PushOptions): boolean {
    if (this.empty()) {
      if (!dryRun) {
        // first token found, just push it
        this.stack.push(TokenKind.FUNCTION);
      }
      return true;
    }

    if (this.end() === TokenKind.OPEN_PARENTHESIS) {
      if (!dryRun) {
        this.stack.push(TokenKind.FUNCTION);
      }
      return true;
    }

    if (this.end() === TokenKind.OPERATOR) {
      if (this.end(1) === TokenKind.FUNCTION) {
        if (!dryRun) {
          // combine the 2 expressions with the operator
          // we can just pop off the operator as we
          // want an expression on the stack
          this.stack.pop();
        }
        return true;
      }
    }

    return false;
  }

  pushFreeText(text: string, _options: PushOptions): boolean {
    // only empty free text tokens are allowed
    // no need to push them onto the stack either
    return text.trim() === '';
  }

  pushOperator({dryRun}: PushOptions): boolean {
    if (this.end() === TokenKind.FUNCTION) {
      if (!dryRun) {
        this.stack.push(TokenKind.OPERATOR);
      }
      return true;
    }
    // expected an expression before the operator
    return false;
  }

  pushParenthesis(parenthesis: Parenthesis, {dryRun}: PushOptions): boolean {
    if (parenthesis === Parenthesis.OPEN) {
      if (this.empty()) {
        if (!dryRun) {
          this.stack.push(TokenKind.OPEN_PARENTHESIS);
        }
        return true;
      }

      if (
        this.end() === TokenKind.OPERATOR ||
        this.end() === TokenKind.OPEN_PARENTHESIS
      ) {
        if (!dryRun) {
          this.stack.push(TokenKind.OPEN_PARENTHESIS);
        }
        return true;
      }

      return false;
    }

    if (parenthesis === Parenthesis.CLOSE) {
      if (this.end() === TokenKind.FUNCTION) {
        if (this.end(1) === TokenKind.OPEN_PARENTHESIS) {
          // found a parenthesized expression
          // we can strip the parenthesis and
          // leave just an expression
          const a = this.stack.pop()!;
          const b = this.stack.pop()!;
          const isAllowed = this.pushExpression({dryRun});
          if (dryRun) {
            this.stack.push(b);
            this.stack.push(a);
          }
          return isAllowed;
        }
      }
    }

    return false;
  }

  isValid(): boolean {
    return this.stack.length === 1 && this.stack[0] === TokenKind.FUNCTION;
  }

  private empty(): boolean {
    return this.stack.length === 0;
  }

  private end(i = 0): TokenKind | undefined {
    return this.stack[this.stack.length - i - 1];
  }
}
