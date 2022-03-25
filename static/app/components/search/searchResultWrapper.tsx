import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  highlighted?: boolean;
}

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
