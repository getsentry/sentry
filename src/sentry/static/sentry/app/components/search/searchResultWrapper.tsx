import styled from '@emotion/styled';
import {css} from '@emotion/core';
import React from 'react';

type Props = {
  highlighted?: boolean;
} & React.HTMLProps<HTMLDivElement>;

const SearchResultWrapper = styled(({highlighted, ...props}: Props) => (
  <div
    {...props}
    ref={element => highlighted && element?.scrollIntoView?.({block: 'nearest'})}
  />
))`
  cursor: pointer;
  display: block;
  color: ${p => p.theme.textColor};
  padding: 10px;
  scroll-margin: 120px;

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.purple300};
      background: ${p.theme.backgroundSecondary};
    `};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

export default SearchResultWrapper;
