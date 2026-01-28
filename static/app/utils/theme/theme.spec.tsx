import {useTheme} from '@emotion/react';
import {expectTypeOf} from 'expect-type';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

describe('theme', () => {
  describe('getColorPalette', () => {
    it('should return correct amount of colors', () => {
      const {result} = renderHookWithProviders(useTheme);
      const theme = result.current;

      expect(theme.chart.getColorPalette(2)).toHaveLength(3);
    });

    it('should return all colors when all is passed', () => {
      const {result} = renderHookWithProviders(useTheme);
      const theme = result.current;

      const colors = theme.chart.getColorPalette('all');

      expect(colors).toHaveLength(18);
    });

    it('should have strict types', () => {
      const {result} = renderHookWithProviders(useTheme);
      const theme = result.current;

      const colors = theme.chart.getColorPalette(2);

      expectTypeOf(colors).toEqualTypeOf<
        | readonly ['#7553FF', '#3A1873', '#F0369A']
        | readonly ['#7553FF', '#50219C', '#F0369A']
      >();
    });
  });
});
