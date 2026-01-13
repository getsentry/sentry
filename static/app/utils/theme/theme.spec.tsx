import {css, useTheme} from '@emotion/react';
import {expectTypeOf} from 'expect-type';

import {render, renderHookWithProviders, screen} from 'sentry-test/reactTestingLibrary';

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

  it('serializes style object using vibrant variant', () => {
    const theme = renderHookWithProviders(useTheme).result.current;

    render(<div style={{borderColor: theme.tokens.border.promotion.vibrant}}>Hello</div>);

    expect(screen.getByText('Hello')).toHaveStyle({
      borderColor: theme.tokens.border.promotion.vibrant,
    });
  });
});
