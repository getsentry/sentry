import type {Token} from './token';
import {tokenizeExpression} from './tokenizer';
import {validateTokens} from './validator';

export class Expression {
  readonly text: string;
  readonly tokens: Token[];
  readonly isValid: boolean;

  constructor(text: string, references?: Set<string>) {
    this.text = text;
    this.tokens = tokenizeExpression(this.text, references);
    this.isValid = validateTokens(this.tokens);
  }
}
