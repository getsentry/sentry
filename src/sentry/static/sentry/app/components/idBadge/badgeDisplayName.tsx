import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

const BadgeDisplayName = styled('span')<{hideOverflow?: string | boolean}>`
  ${p =>
    p.hideOverflow &&
    `
      ${overflowEllipsis};
      max-width: ${
        typeof p.hideOverflow === 'string'
          ? p.hideOverflow
          : p.theme.settings.maxCrumbWidth
      }
  `};
  padding: ${space(0.25)} 0;
`;

export default BadgeDisplayName;
