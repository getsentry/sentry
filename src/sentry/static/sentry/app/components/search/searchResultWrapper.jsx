import {css} from 'emotion';
import React from 'react';
import styled from 'react-emotion';

const SearchResultWrapper = styled(({highlighted, ...props}) => <div {...props} />)`
  display: block;
  color: ${p => p.theme.gray5};
  padding: 10px;
  border-top: 1px solid ${p => p.theme.borderLight};

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.purpleDarkest};
      background: ${p.theme.offWhite};
    `};

  &:first-child {
    border-radius: 4px 4px 0 0;
  }

  &:last-child {
    border-bottom: 0;
    border-radius: 0 0 4px 4px;
  }
`;

export default SearchResultWrapper;
