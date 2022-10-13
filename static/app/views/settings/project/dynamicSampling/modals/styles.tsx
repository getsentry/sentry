import {css} from '@emotion/react';

import commonTheme from 'sentry/utils/theme';

export const responsiveModal = css`
  @media (max-width: ${commonTheme.breakpoints.small}) {
    width: 100%;
  }
`;
