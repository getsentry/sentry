/* eslint-disable react/jsx-key */
import React from 'react';
import {Link} from 'react-router';
import styled from 'styled-components';

import colors from '../../style-utils';

const BaseNavItem = styled(Link)`
  color: ${colors.gray80};
  font-size: 16px;
  line-height: 1.5;
  padding: 0;
  margin: 4px 0;
  display: block;
  position: relative;

  &:hover {
    color: ${colors.black};
  }
`;

const NavItem = styled(({className, ...props}) => <BaseNavItem {...props} activeClassName={className} />)`
  color: ${colors.black};
  font-weight: 600;

  &:before {
    display: block;
    position: absolute;
    top: 3px;
    left: -30px;
    bottom: 3px;
    width: 4px;
    background-color: ${colors.purple};
    content: '';
  }
`;

export default NavItem;
