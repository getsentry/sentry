import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {
  isTokenFreeText,
  isTokenFunction,
  isTokenOperator,
  isTokenParenthesis,
  Parenthesis,
} from 'sentry/components/arithmeticBuilder/token';

export function validateTokens(tokens: Token[]): boolean {
  const validator = new ExpressionValidator();

  for (const token of tokens) {
    if (!validator.push(token)) {
      return false;
    }
  }

  return validator.isValid();
}

enum Part {
  OPEN_PAREN = '(',
  OPERATOR = 'o',
  EXPRESSION = 'e',
}

class ExpressionValidator {
  private stack: Part[];

  constructor() {
    this.stack = [];
  }

  push(token: Token): boolean {
    if (isTokenFunction(token)) {
      return this.pushFunction();
    }

    if (isTokenFreeText(token)) {
      return this.pushFreeText(token.text);
    }

    if (isTokenOperator(token)) {
      return this.pushOperator();
    }

    if (isTokenParenthesis(token)) {
      return this.pushParenthesis(token.parenthesis);
    }

    return false;
  }

  pushFunction(): boolean {
    if (this.empty()) {
      // first token found, just push it
      this.stack.push(Part.EXPRESSION);
      return true;
    }

    if (this.end() === Part.OPEN_PAREN) {
      this.stack.push(Part.EXPRESSION);
      return true;
    }

    if (this.end() === Part.OPERATOR) {
      if (this.end(1) === Part.EXPRESSION) {
        this.stack.pop();
        return true;
      }
    }

    return false;
  }

  pushFreeText(text: string): boolean {
    // only empty free text tokens are allowed
    // no need to push them onto the stack either
    return text.trim() === '';
  }

  pushOperator(): boolean {
    if (this.end() === Part.EXPRESSION) {
      this.stack.push(Part.OPERATOR);
      return true;
    }
    // expected an expression before the operator
    return false;
  }

  pushParenthesis(parenthesis: Parenthesis): boolean {
    if (parenthesis === Parenthesis.OPEN) {
      if (this.empty()) {
        this.stack.push(Part.OPEN_PAREN);
        return true;
      }

      if (this.end() === Part.OPERATOR || this.end() === Part.OPEN_PAREN) {
        this.stack.push(Part.OPEN_PAREN);
        return true;
      }

      return false;
    }

    if (parenthesis === Parenthesis.CLOSE) {
      if (this.end() === Part.EXPRESSION) {
        if (this.end(1) === Part.OPEN_PAREN) {
          this.stack.pop();
          this.stack.pop();
          return this.pushFunction();
        }
      }
    }

    return false;
  }

  isValid(): boolean {
    return this.stack.length === 1 && this.stack[0] === Part.EXPRESSION;
  }

  private empty(): boolean {
    return this.stack.length === 0;
  }

  private end(i: number = 0): Part | undefined {
    return this.stack[this.stack.length - i - 1];
  }
}
