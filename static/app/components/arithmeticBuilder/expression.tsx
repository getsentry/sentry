import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {validateTokens} from 'sentry/components/arithmeticBuilder/validator';

export class Expression {
  readonly text: string;
  readonly tokens: Token[];
  readonly isValid: boolean;

  constructor(text: string) {
    this.text = text;
    this.tokens = tokenizeExpression(this.text);
    this.isValid = validateTokens(this.tokens);
  }
}
