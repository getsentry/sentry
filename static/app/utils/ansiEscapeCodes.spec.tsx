import {parseAnsi, stripAnsi} from 'sentry/utils/ansiEscapeCodes';

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

  describe('parseAnsi', () => {
    it('returns a single unstyled segment for plain text', () => {
      expect(parseAnsi('plain text')).toEqual([{content: 'plain text'}]);
    });

    it('splits basic and bright foreground colors into segments', () => {
      expect(parseAnsi('\x1B[31merror\x1B[0m: \x1B[92mok\x1B[0m')).toEqual([
        {content: 'error', fg: {type: 'named', name: 'red', bright: false}},
        {content: ': '},
        {content: 'ok', fg: {type: 'named', name: 'green', bright: true}},
      ]);
    });

    it('parses background colors and decorations', () => {
      expect(parseAnsi('\x1B[1;33;44mwarn')).toEqual([
        {
          content: 'warn',
          fg: {type: 'named', name: 'yellow', bright: false},
          bg: {type: 'named', name: 'blue', bright: false},
          decoration: 'bold',
        },
      ]);
    });

    it('maps 256-color palette indexes to named or RGB colors', () => {
      expect(parseAnsi('\x1B[38;5;9ma\x1B[38;5;208mb\x1B[38;5;244mc')).toEqual([
        {content: 'a', fg: {type: 'named', name: 'red', bright: true}},
        {content: 'b', fg: {type: 'rgb', rgb: '255, 135, 0'}},
        {content: 'c', fg: {type: 'rgb', rgb: '128, 128, 128'}},
      ]);
    });

    it('parses truecolor without leaking it into later segments', () => {
      expect(parseAnsi('\x1B[38;2;1;2;3ma\x1B[0m\x1B[31mb')).toEqual([
        {content: 'a', fg: {type: 'rgb', rgb: '1, 2, 3'}},
        {content: 'b', fg: {type: 'named', name: 'red', bright: false}},
      ]);
    });

    it('removes non-color escape codes from segment content', () => {
      expect(parseAnsi('\x1B[2Kdone\x1B[?25h')).toEqual([{content: 'done'}]);
    });
  });
});
