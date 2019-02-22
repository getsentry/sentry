import {css} from 'emotion';
import React from 'react';
import styled from 'react-emotion';

const SearchResultWrapper = styled(({highlighted, ...props}) => <div {...props} />)`
  cursor: pointer;
  display: block;
  color: ${p => p.theme.gray5};
  padding: 10px;

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.purpleDarkest};
      background: ${p.theme.offWhite};
    `};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.borderLight};
  }
`;

export default SearchResultWrapper;
