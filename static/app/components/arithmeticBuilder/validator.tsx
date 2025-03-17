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

/**
 * Given a list of arithmetic tokens, compute a list of allowed token
 * kinds at free text token.
 *
 * The algorithm is as follows:
 * - All non free text tokens should not have any suggestions
 *   as they already have a valid token filled in.
 * - All free text tokens should consider as many tokens before it
 *   as possible to determine what tokens are allowed next.
 */
export function computeNextAllowedTokenKinds(tokens: Array<Token | null>): TokenKind[][] {
  const validator = new ExpressionValidator();
  const tokenKinds = [];

  for (const token of tokens) {
    if (!defined(token)) {
      // because of how react-stately works, the type here
      // is nullable so make sure to handle it
      tokenKinds.push([]);
    } else if (isTokenFreeText(token)) {
      // once we arrive at a free text token, check to see
      // what tokens are allowed next given the current state
      tokenKinds.push(validator.nextAllowedTokenKinds());
    } else {
      // if it is any other token type, update the validator
      // state with it as it'll be used to determine the next
      // allowed token
      if (!validator.push(token)) {
        // if the push operation failed, meaning adding the
        // current token onto the validator produces an invalid
        // state, we reset the validator and use the current token
        // as the state
        //
        // this is to ensure that partially valid expressions still
        // have decent autocomplete suggestions
        validator.force([token]);
      }
      tokenKinds.push([]);
    }
  }

  return tokenKinds;
}

interface PushOptions {
  /**
   * Runs the push operation in a dry run mode. Meaning
   * the stack should remain unmodified after the attempt
   * but we will get back the if the operation will be
   * successful or not.
   */
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
    // attempts to push all potential tokens in dry run mode
    // and return the ones that produce a valid expression
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

          // Because this requires a recursive check, we have
          // to pop the items off the stack before the recursive
          // call. So in dry run mode, we have to make sure we
          // restore the stack to the original state here.
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
