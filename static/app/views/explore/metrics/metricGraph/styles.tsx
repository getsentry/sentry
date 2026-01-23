import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {FooterWrapper, Header} from 'sentry/views/dashboards/widgets/widget/widget';

// hideFooterBorder is used to hide the top border of the footer when
// the aggregates/samples tables are on the bottom. This is so the footer
// maintains its visual relationship with the graph and not the tables.
export const WidgetWrapper = styled('div')<{hideFooterBorder?: boolean}>`
  height: 100%;
  ${p =>
    p.hideFooterBorder &&
    css`
      ${FooterWrapper} {
        border-top: none;
      }
    `}

  ${Header} {
    padding-top: ${p => p.theme.space.md};
  }
`;
