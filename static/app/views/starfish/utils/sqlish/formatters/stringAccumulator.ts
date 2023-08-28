export class StringAccumulator {
  lines: Line[];

  constructor() {
    this.lines = [new Line()];
  }

  get lastLine(): Line {
    return this.lines.at(-1) as Line;
  }

  get lastToken(): string | undefined {
    return this.lastLine.lastToken;
  }

  add(token: string) {
    if (!token) {
      return;
    }

    this.lastLine.add(token);
  }

  space() {
    this.lastLine.add(SPACE);
  }

  break() {
    const newLine = new Line();
    newLine.indentTo(this.lastLine.indentation);

    this.lines.push(newLine);
  }

  indent() {
    this.lastLine.indent();
  }

  unindent() {
    this.lastLine.unindent();
  }

  indentTo(level: number = 1) {
    this.lastLine.indentTo(level);
  }

  toString() {
    return this.lines
      .map(line => line.toString())
      .join(NEWLINE)
      .trim();
  }
}

class Line {
  tokens: string[];
  indentation: number;

  constructor() {
    this.tokens = [];
    this.indentation = 0;
  }

  get lastToken() {
    return this.tokens.at(-1);
  }

  get isEmpty() {
    return this.toString().trim() === '';
  }

  add(token: string) {
    this.tokens.push(token);
  }

  indent() {
    this.indentation += 1;
  }

  indentTo(level: number) {
    this.indentation = level;
  }

  unindent() {
    this.indentation -= 1;
  }

  toString() {
    return `${INDENTATION.repeat(this.indentation)}${this.tokens.join('').trimEnd()}`;
  }
}

const SPACE = ' ';
const INDENTATION = '  ';
const NEWLINE = '\n';
