import type {Theme} from '@emotion/react';

import {checkBreakpoints} from 'sentry/utils/useBreakpoints';

describe('checkBreakpoints', () => {
  it('returns true for active breakpoints', () => {
    const breakpoints: Record<keyof Theme['breakpoints'], string> = {
      xs: '0px',
      sm: '0px',
      md: '1px',
      lg: '2px',
      xl: '3px',
      '2xl': '4px',
    };

    expect(checkBreakpoints(breakpoints, 2)).toEqual({
      xs: true,
      sm: true,
      md: true,
      lg: true,
      xl: false,
      '2xl': false,
    });
  });
});
