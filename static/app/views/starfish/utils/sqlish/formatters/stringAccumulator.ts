export class StringAccumulator {
  tokens: string[];

  constructor() {
    this.tokens = [];
  }

  add(token: string) {
    if (!token) {
      return;
    }

    this.tokens.push(token);
  }

  space() {
    this.rtrim();
    this.tokens.push(SPACE);
  }

  break() {
    this.rtrim();

    this.tokens.push(NEWLINE);
  }

  indent(count: number = 1) {
    this.tokens.push(INDENTATION.repeat(count));
  }

  rtrim() {
    while (this.tokens.at(-1)?.trim() === '') {
      this.tokens.pop();
    }
  }

  endsWith(token: string) {
    return this.tokens.at(-1) === token;
  }

  toString() {
    return this.tokens.join('').trim();
  }
}
const SPACE = ' ';
const INDENTATION = '  ';
const NEWLINE = '\n';
