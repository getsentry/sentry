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

  describe('backwards compatibility tokens', () => {
    it.each<['border' | 'graphics']>([['border'], ['graphics']])(
      '%s should coerce to vibrant in template literals',
      name => {
        const theme = renderHookWithProviders(useTheme).result.current;
        const token = theme.tokens[name].promotion;
        expect(`color: ${token}`).toBe(`color: ${token.vibrant}`);
      }
    );

    it.each<['border' | 'graphics']>([['border'], ['graphics']])(
      '%s token should equal its vibrant value when coerced',
      name => {
        const theme = renderHookWithProviders(useTheme).result.current;
        const token = theme.tokens[name].promotion;

        // Test coercion to string equals vibrant value
        expect(String(token)).toBe(token.vibrant);
        expect(`${token}`).toBe(token.vibrant);
      }
    );

    it('should work with Emotion css function for border tokens', () => {
      const theme = renderHookWithProviders(useTheme).result.current;

      expect(css`
        border: 1px solid ${theme.tokens.border.promotion};
      `).toMatchObject({
        styles: expect.stringContaining(theme.tokens.border.promotion.vibrant),
      });
    });

    it('should work with css template', () => {
      const theme = renderHookWithProviders(useTheme).result.current;

      expect(css`
        background: ${theme.tokens.graphics.promotion};
      `).toMatchObject({
        styles: expect.stringContaining(theme.tokens.graphics.promotion.vibrant),
      });
    });

    it('should work via object reference', () => {
      const theme = renderHookWithProviders(useTheme).result.current;
      const config = {iconBorder: theme.tokens.border.danger};

      expect(css`
        border-color: ${config.iconBorder};
      `).toMatchObject({
        styles: expect.stringContaining(theme.tokens.border.danger.vibrant),
      });
    });

    it.each<['border' | 'graphics']>([['border'], ['graphics']])(
      '%s token should serialize to vibrant value in JSON',
      name => {
        const theme = renderHookWithProviders(useTheme).result.current;
        const token = theme.tokens[name].promotion;

        const serialized = JSON.stringify({color: token});
        const expected = JSON.stringify({color: token.vibrant});

        expect(serialized).toBe(expected);
      }
    );
  });

  it('serializes style object to vibrant value in JSON', () => {
    const theme = renderHookWithProviders(useTheme).result.current;

    render(<div style={{borderColor: theme.tokens.border.promotion}}>Hello</div>);

    expect(screen.getByText('Hello')).toHaveStyle({
      borderColor: theme.tokens.border.promotion.vibrant,
    });
  });
});
