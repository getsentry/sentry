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
});
