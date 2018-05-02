import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Badge from 'app/components/badge';
import space from '../../../styles/space';

const StyledNavItem = styled(Link)`
  display: block;
  color: ${p => p.theme.gray2};
  font-size: 14px;
  line-height: 30px;
  position: relative;

  &.active {
    color: ${p => p.theme.gray5};

    &:before {
      background: ${p => p.theme.purple};
    }
  }

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.gray5};
  }

  &:before {
    position: absolute;
    content: '';
    display: block;
    top: 7px;
    left: -22px;
    height: 14px;
    width: 2px;
    background: transparent;
    border-radius: 1px;
  }
`;

const NewBadge = styled(Badge)`
  background: ${p => p.theme.yellowOrange};
  border-radius: 2px;
  border: 1px solid ${p => p.theme.yellowOrangeDark};
  height: auto;
  padding: ${space(0.25)} ${space(0.5)};
  line-height: 1;
`;

class SettingsNavItem extends React.Component {
  static propTypes = {
    label: PropTypes.node.isRequired,
    badge: PropTypes.node,
    index: PropTypes.bool,
  };

  render() {
    let {badge, label, index, ...props} = this.props;

    let renderedBadge = '';

    if (badge === 'new') {
      renderedBadge = <NewBadge text={badge} />;
    } else {
      renderedBadge = <Badge text={badge} />;
    }

    return (
      <StyledNavItem onlyActiveOnIndex={index} activeClassName="active" {...props}>
        {label} {badge ? renderedBadge : null}
      </StyledNavItem>
    );
  }
}
export default SettingsNavItem;
