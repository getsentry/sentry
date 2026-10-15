import {expectTypeOf} from 'expect-type';

import {darkTheme, lightTheme} from './index';

describe.each([lightTheme, darkTheme])('$type theme', theme => {
  describe('getColorPalette', () => {
    it('should return correct amount of colors', () => {
      expect(theme.chart.getColorPalette(2)).toHaveLength(3);
    });

    it('should return all colors when all is passed', () => {
      const colors = theme.chart.getColorPalette('all');

      expect(colors).toHaveLength(18);
    });

    it('should have strict types', () => {
      const colors = theme.chart.getColorPalette(2);

      expectTypeOf(colors).toEqualTypeOf<
        | readonly ['#7553FF', '#3A1873', '#F0369A']
        | readonly ['#7553FF', '#50219C', '#F0369A']
      >();
    });
  });

  describe('swatch', () => {
    it('should match old getColorPalette(9) colors for backward compatibility', () => {
      const oldPalette = theme.chart.getColorPalette(9);
      const swatchColors = new Set(theme.swatch.values());

      expect(swatchColors.size).toBe(10);
      expect(swatchColors.size).toBe(oldPalette.length);

      for (const color of oldPalette) {
        expect(swatchColors.has(color)).toBe(true);
      }
    });
  });

  it('provides focus styles', () => {
    expect(theme.focusRing()).toEqual({
      outline: 'none',
      boxShadow: `0 0 0 0 ${theme.tokens.background.primary}, 0 0 0 2px ${theme.tokens.focus.default}`,
    });
  });
});

it.each([
  ['production', undefined, false],
  ['development', undefined, false],
  ['test', undefined, true],
  ['production', '1', true],
  ['development', '1', true],
] as const)(
  'configures motion for NODE_ENV=%s and IS_ACCEPTANCE_TEST=%s',
  async (nodeEnv, acceptanceTest, disabled) => {
    const environment = jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: nodeEnv,
      IS_ACCEPTANCE_TEST: acceptanceTest,
    });

    try {
      await jest.isolateModulesAsync(async () => {
        const {darkTheme, lightTheme} = await import('./theme');

        for (const theme of [lightTheme, darkTheme]) {
          expect(theme.motion.framer.smooth.fast.duration).toBe(disabled ? 0 : 0.12);
          expect(theme.motion.smooth.fast).toBe('120ms cubic-bezier(0.72, 0, 0.16, 1)');
        }
      });
    } finally {
      environment.restore();
    }
  }
);
