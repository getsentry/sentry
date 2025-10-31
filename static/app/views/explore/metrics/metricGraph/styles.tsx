import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {FooterWrapper} from 'sentry/views/dashboards/widgets/widget/widget';

export const WidgetWrapper = styled('div')<{hideFooterBorder?: boolean}>`
  height: 100%;
  ${p =>
    p.hideFooterBorder &&
    css`
      ${FooterWrapper} {
        border-top: none;
      }
    `}
`;
