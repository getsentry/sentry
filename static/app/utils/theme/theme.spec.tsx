import {useTheme} from '@emotion/react';
import {QueryClient} from '@tanstack/react-query';
import {expectTypeOf} from 'expect-type';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {QueryClientProvider} from 'sentry/utils/queryClient';

const wrapper = ({children}: {children?: React.ReactNode}) => (
  <QueryClientProvider client={new QueryClient()}>
    <ThemeAndStyleProvider>{children}</ThemeAndStyleProvider>
  </QueryClientProvider>
);

describe('theme', () => {
  describe('getColorPalette', () => {
    it('should return correct amount of colors', () => {
      const {result} = renderHook(useTheme, {wrapper});

      const theme = result.current;

      expect(theme.chart.getColorPalette(2)).toHaveLength(3);
    });

    it('should have strict types', () => {
      const {result} = renderHook(useTheme, {wrapper});

      const theme = result.current;

      const colors = theme.chart.getColorPalette(2);

      expectTypeOf(colors).toEqualTypeOf<readonly ['#444674', '#d6567f', '#f2b712']>();
    });
  });
});
