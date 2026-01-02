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

    it('should have strict types', () => {
      const {result} = renderHookWithProviders(useTheme);

      const theme = result.current;

      const colors = theme.chart.getColorPalette(2);

      expectTypeOf(colors).toEqualTypeOf<
        | readonly ['#7B52FF', '#401477', '#FF049B']
        | readonly ['#7B52FF', '#613CB9', '#FF049B']
      >();
    });
  });
});
