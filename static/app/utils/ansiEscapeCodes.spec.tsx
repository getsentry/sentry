import {applyCarriageReturns, stripAnsi} from 'sentry/utils/ansiEscapeCodes';

describe('ansiEscapeCodes', () => {
  it('removes ANSI color codes', () => {
    const colored = '\x1B[31mThis is red text\x1B[0m';
    expect(stripAnsi(colored)).toBe('This is red text');
  });

  it('removes multiple ANSI codes', () => {
    const input = '\x1B[32mGreen\x1B[0m and \x1B[34mBlue\x1B[0m';
    expect(stripAnsi(input)).toBe('Green and Blue');
  });

  it('returns the original string if there are no ANSI codes', () => {
    const plain = 'Just a normal string.';
    expect(stripAnsi(plain)).toBe(plain);
  });

  it('handles empty strings', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('handles strings with mixed characters and ANSI codes', () => {
    const input = 'Hello \x1B[1mWorld\x1B[0m!';
    expect(stripAnsi(input)).toBe('Hello World!');
  });
});

describe('applyCarriageReturns', () => {
  it('keeps only the final write when given carriage-return progress updates', () => {
    expect(applyCarriageReturns('10%\r50%\r100%\ndone')).toBe('100%\ndone');
  });

  it('keeps line endings when given CRLF text', () => {
    expect(applyCarriageReturns('first\r\nsecond\r\n')).toBe('first\r\nsecond\r\n');
  });
});
