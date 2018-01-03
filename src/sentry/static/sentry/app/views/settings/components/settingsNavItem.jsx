import {Link} from 'react-router';
import {withTheme} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Badge from '../../../components/badge';

const StyledNavItem = withTheme(
  styled(({active, ...props}) => <Link {...props} />)`
    display: block;
    color: ${p => (p.active ? p.theme.gray5 : p.theme.gray2)};
    font-size: 14px;
    line-height: 30px;
    position: relative;

    &:hover,
    &:focus,
    &:active {
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
      background: ${p => (p.active ? p.theme.purple : 'transparent')};
      border-radius: 1px;
    }
  `
);

class SettingsNavItem extends React.Component {
  static propTypes = {
    label: PropTypes.node.isRequired,
    badge: PropTypes.node,
  };

  render() {
    let {badge, label, ...props} = this.props;

    return (
      <StyledNavItem {...props}>
        {label} {badge ? <Badge text={badge} /> : null}
      </StyledNavItem>
    );
  }
}
export default SettingsNavItem;
