import React from 'react';
import {Link} from 'react-router';
import styled from 'react-emotion';
import {withTheme} from 'emotion-theming';

export default withTheme(
  styled(({label, ...props}) => <Link {...props} children={label} />)`
    display: block;
    color: ${p => (p.active === true ? p.theme.gray5 : p.theme.gray2)};
    font-size: 14px;
    line-height: 30px;
    position: relative;

    &:hover, &:focus, &:active {
      color: ${p => p.theme.gray5};
    }

    &:before {
      position: absolute;
      content: '';
      display: block;
      top: 8px;
      left: -22px;
      height: 14px;
      width: 2px;
      background: ${p => (p.active === true ? p.theme.purple : 'transparent')};
      border-radius: 1px;
    }
  `
);
