import type {Theme} from '@emotion/react';

import {checkBreakpoints} from 'sentry/utils/useBreakpoints';

describe('checkBreakpoints', () => {
  it('returns true for active breakpoints', () => {
    const breakpoints: Record<keyof Theme['breakpoints'], string> = {
      xsmall: '0px',
      small: '0px',
      medium: '1px',
      large: '2px',
      xlarge: '3px',
      xxlarge: '4px',
    };

    expect(checkBreakpoints(breakpoints, 2)).toEqual({
      xsmall: true,
      small: true,
      medium: true,
      large: true,
      xlarge: false,
      xxlarge: false,
    });
  });
});
