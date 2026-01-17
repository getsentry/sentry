import {css} from '@emotion/react';
import styled from '@emotion/styled';

const BadgeDisplayName = styled('span')<{hideOverflow?: string | boolean}>`
  ${p =>
    p.hideOverflow &&
    css`
      display: block;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: ${typeof p.hideOverflow === 'string'
        ? p.hideOverflow
        : // @TODO(jonasbadalic) 240px used to be defined as theme.settings.maxCrumbWidth and only used here
          '240px'};
    `};
`;

export default BadgeDisplayName;
