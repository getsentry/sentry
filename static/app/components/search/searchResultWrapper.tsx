import {css} from '@emotion/react';
import styled from '@emotion/styled';

const SearchResultWrapper = styled('div')<{highlighted?: boolean}>`
  cursor: pointer;
  display: block;
  color: ${p => p.theme.textColor};
  padding: 10px;
  scroll-margin: 120px;

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.activeText};
      background: ${p.theme.backgroundSecondary};
    `};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

export default SearchResultWrapper;
