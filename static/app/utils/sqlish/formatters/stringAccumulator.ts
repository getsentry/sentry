export class StringAccumulator {
  lines: Line[];

  constructor() {
    this.lines = [new Line()];
  }

  get lastLine(): Line {
    return this.lines.at(-1) as Line;
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

  indentTo(level = 1) {
    this.lastLine.indentTo(level);
  }

  toString(maxLineLength: number = DEFAULT_MAX_LINE_LENGTH) {
    let output: Line[] = [];

    this.lines.forEach(line => {
      if (line.textLength <= maxLineLength) {
        output.push(line);
        return;
      }

      const splitLines: Line[] = [new Line([], line.indentation)];
      let tokenIndex = 0;

      while (tokenIndex < line.tokens.length) {
        const incomingToken = line.tokens.at(tokenIndex) as string;

        const totalLength = (splitLines.at(-1) as Line).textLength + incomingToken.length;

        if (totalLength <= maxLineLength) {
          splitLines.at(-1)?.add(incomingToken);
        } else {
          splitLines.push(new Line([incomingToken], line.indentation + 1));
        }

        tokenIndex += 1;
      }

      output = [...output, ...splitLines.filter(splitLine => !splitLine.isEmpty)];
    });

    return output.join(NEWLINE).trim();
  }
}

const DEFAULT_MAX_LINE_LENGTH = 100;

class Line {
  tokens: string[];
  indentation: number;

  constructor(tokens: string[] = [], indentation = 0) {
    this.tokens = tokens;
    this.indentation = indentation;
  }

  get isEmpty() {
    return this.toString().trim() === '';
  }

  get length() {
    return this.toString().length;
  }

  get textLength() {
    return this.toString().trim().length;
  }

  add(token: string) {
    this.tokens.push(token);
  }

  indent() {
    this.indentation += 1;
  }

  unindent() {
    this.indentation -= 1;
  }

  indentTo(level: number) {
    this.indentation = level;
  }

  toString() {
    return `${INDENTATION.repeat(this.indentation)}${this.tokens.join('').trimEnd()}`;
  }
}

const SPACE = ' ';
const INDENTATION = '  ';
const NEWLINE = '\n';
