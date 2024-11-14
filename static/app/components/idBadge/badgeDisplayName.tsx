import {css} from '@emotion/react';
import styled from '@emotion/styled';

const BadgeDisplayName = styled('span')<{hideOverflow?: string | boolean}>`
  ${p =>
    p.hideOverflow &&
    css`
      ${p.theme.overflowEllipsis};
      max-width: ${typeof p.hideOverflow === 'string'
        ? p.hideOverflow
        : p.theme.settings.maxCrumbWidth};
    `};
`;

export default BadgeDisplayName;
