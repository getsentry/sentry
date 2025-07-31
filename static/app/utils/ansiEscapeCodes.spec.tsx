import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';

describe('ansiEscapeCodes', () => {
  it('removes ANSI color codes', () => {
    const colored = '\x1b[31mThis is red text\x1b[0m';
    expect(stripAnsi(colored)).toBe('This is red text');
  });

  it('removes multiple ANSI codes', () => {
    const input = '\x1b[32mGreen\x1b[0m and \x1b[34mBlue\x1b[0m';
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
    const input = 'Hello \x1b[1mWorld\x1b[0m!';
    expect(stripAnsi(input)).toBe('Hello World!');
  });
});
