import styled from '@emotion/styled';
import {css} from '@emotion/core';
import React from 'react';
import omit from 'lodash/omit';

const SearchResultWrapper = styled(props => <div {...omit(props, 'highlighted')} />)`
  cursor: pointer;
  display: block;
  color: ${p => p.theme.gray800};
  padding: 10px;

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.purple500};
      background: ${p.theme.gray100};
    `};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.borderLight};
  }
`;

export default SearchResultWrapper;
