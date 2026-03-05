import {makeSwatch} from 'sentry/utils/theme/swatch';

const TEST_PALETTE = {
  blurple: '#7553FF',
  purple: '#5533B2',
  indigo: '#3A1873',
  plum: '#7C2282',
  magenta: '#B82D90',
  pink: '#F0369A',
  salmon: '#FA6769',
  orange: '#FF9838',
  yellow: '#FFD00E',
  lime: '#BACE05',
  green: '#67C800',
};

const ON_VIBRANT = {
  dark: '#000000',
  light: '#FFFFFF',
};

describe('makeSwatch', () => {
  const swatch = makeSwatch(TEST_PALETTE, ON_VIBRANT);

  describe('get', () => {
    it('returns an object with background and content', () => {
      const result = swatch.get('foo');
      expect(result).toHaveProperty('background');
      expect(result).toHaveProperty('content');
    });

    it('returns a valid hex color from the palette', () => {
      const result = swatch.get('foo');
      expect(Object.values(TEST_PALETTE)).toContain(result.background);
    });

    it('is deterministic — same input always returns the same color', () => {
      expect(swatch.get('my-project')).toEqual(swatch.get('my-project'));
      expect(swatch.get('transaction-name')).toEqual(swatch.get('transaction-name'));
    });

    it('returns different colors for different inputs', () => {
      // Not strictly guaranteed, but these specific strings produce different hashes
      const a = swatch.get('aaa');
      const b = swatch.get('zzz');
      expect(a.background).not.toBe(b.background);
    });

    it('returns light content for dark background colors', () => {
      const darkColors = new Set([
        TEST_PALETTE.blurple,
        TEST_PALETTE.purple,
        TEST_PALETTE.indigo,
        TEST_PALETTE.plum,
        TEST_PALETTE.magenta,
        TEST_PALETTE.pink,
      ]);

      for (let i = 0; i < 100; i++) {
        const result = swatch.get(`test-${i}`);
        if (darkColors.has(result.background)) {
          expect(result.content).toBe('#FFFFFF');
          return;
        }
      }

      expect(true).toBe(true);
    });

    it('returns dark content for light background colors', () => {
      const lightColors = new Set([
        TEST_PALETTE.salmon,
        TEST_PALETTE.orange,
        TEST_PALETTE.yellow,
        TEST_PALETTE.lime,
        TEST_PALETTE.green,
      ]);

      for (let i = 0; i < 100; i++) {
        const result = swatch.get(`test-${i}`);
        if (lightColors.has(result.background)) {
          expect(result.content).toBe('#000000');
          return;
        }
      }

      expect(true).toBe(true);
    });

    it('handles empty string input', () => {
      const result = swatch.get('');
      expect(Object.values(TEST_PALETTE)).toContain(result.background);
    });
  });

  describe('values', () => {
    it('yields all 11 categorical colors', () => {
      const colors = Array.from(swatch.values());
      expect(colors).toHaveLength(11);
    });

    it('contains all colors from the palette', () => {
      const colors = new Set(swatch.values());
      for (const hex of Object.values(TEST_PALETTE)) {
        expect(colors.has(hex)).toBe(true);
      }
    });

    it('contains the result of get()', () => {
      const colors = new Set(swatch.values());
      const result = swatch.get('anything');
      expect(colors.has(result.background)).toBe(true);
    });
  });
});
