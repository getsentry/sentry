/* eslint-disable react/jsx-key */
import React from 'react';
import {Link} from 'react-router';
import styled from 'styled-components';

const BaseNavItem = styled(Link)`
  color: #493e54;
  font-size: 16px;
  line-height: 1.5;
  padding: 0;
  margin: 4px 0;
  display: block;
  position: relative;

  &:hover {
    color: #161319;
  }
`;

const NavItem = styled(({className, ...props}) => <BaseNavItem {...props} activeClassName={className} />)`
  color: #161319;
  font-weight: 600;

  &:before {
    display: block;
    position: absolute;
    top: 3px;
    left: -30px;
    bottom: 3px;
    width: 4px;
    background-color: #6C5FC7;
    content: '';
  }
`;

export default NavItem;
