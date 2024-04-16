import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const BadgeDisplayName = styled('span')<{hideOverflow?: string | boolean}>`
  ${p =>
    p.hideOverflow &&
    css`
      ${p.theme.overflowEllipsis};
      max-width: ${typeof p.hideOverflow === 'string'
        ? p.hideOverflow
        : p.theme.settings.maxCrumbWidth};
    `};
  padding: ${space(0.25)} 0;
`;

export default BadgeDisplayName;
