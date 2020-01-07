import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import HookOrDefault from 'app/components/hookOrDefault';
import Tooltip from 'app/components/tooltip';

import Link from '../links/link';
import TextOverflow from '../textOverflow';

const LabelHook = HookOrDefault({
  hookName: 'sidebar:item-label',
  defaultComponent: ({children}) => {
    return <React.Fragment>{children}</React.Fragment>;
  },
});

class SidebarItem extends React.Component {
  static propTypes = {
    ...Link.propTypes,
    router: PropTypes.object,
    href: PropTypes.string,
    id: PropTypes.string,
    to: PropTypes.string,
    onClick: PropTypes.func,

    // Is sidebar item active
    active: PropTypes.bool,

    // Is sidebar in a collapsed state
    collapsed: PropTypes.bool,

    // Sidebar has a panel open
    hasPanel: PropTypes.bool,

    // Icon to display
    icon: PropTypes.node,

    // Label to display (only when expanded)
    label: PropTypes.node,

    // Additional badge to display after label
    badge: PropTypes.number,

    // Sidebar is at "top" or "left" of screen
    orientation: PropTypes.oneOf(['top', 'left']),
  };

  handleClick = e => {
    const {id, onClick} = this.props;

    if (typeof onClick !== 'function') {
      return;
    }

    onClick(id, e);
  };

  render() {
    const {
      router,
      href,
      to,
      icon,
      label,
      badge,
      active,
      hasPanel,
      collapsed,
      className,
      orientation,
    } = this.props;

    // If there is no active panel open and if path is active according to react-router
    const isActiveRouter =
      (!hasPanel && router && to && location.pathname.startsWith(to)) ||
      // TODO: this won't be necessary once we remove settingsHome
      (label === 'Settings' && location.pathname.startsWith('/settings/'));

    const isActive = active || isActiveRouter;
    const isTop = orientation === 'top';
    const placement = isTop ? 'bottom' : 'right';

    return (
      <Tooltip disabled={!collapsed} title={label} placement={placement}>
        <StyledSidebarItem
          data-test-id={this.props['data-test-id']}
          active={isActive ? 'true' : undefined}
          href={href}
          to={to}
          className={className}
          onClick={this.handleClick}
        >
          <SidebarItemWrapper>
            <SidebarItemIcon>{icon}</SidebarItemIcon>
            {!collapsed && !isTop && (
              <SidebarItemLabel>
                <LabelHook id={this.props.id}>
                  <TextOverflow>{label}</TextOverflow>
                </LabelHook>
              </SidebarItemLabel>
            )}
            {badge > 0 && (
              <SidebarItemBadge collapsed={collapsed}>{badge}</SidebarItemBadge>
            )}
          </SidebarItemWrapper>
        </StyledSidebarItem>
      </Tooltip>
    );
  }
}

export default withRouter(SidebarItem);

const getActiveStyle = ({active, theme}) => {
  if (!active) {
    return '';
  }
  return css`
    color: ${theme.white};

    &:active,
    &:focus,
    &:hover {
      color: ${theme.white};
    }

    &:before {
      background-color: ${theme.purple};
    }
  `;
};

const StyledSidebarItem = styled(Link)`
  display: flex;
  color: inherit;
  position: relative;
  cursor: pointer;
  font-size: 15px;
  line-height: 32px;
  height: 34px;
  flex-shrink: 0;

  transition: 0.15s color linear;

  &:before {
    display: block;
    content: '';
    position: absolute;
    top: 4px;
    left: -20px;
    bottom: 6px;
    width: 5px;
    border-radius: 0 3px 3px 0;
    background-color: transparent;
    transition: 0.15s background-color linear;
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin: 0 4px;

    &:before {
      top: auto;
      left: 5px;
      bottom: -10px;
      height: 5px;
      width: auto;
      right: 5px;
      border-radius: 3px 3px 0 0;
    }
  }

  &:hover,
  &:focus {
    color: ${p => p.theme.gray1};
  }

  &.focus-visible {
    outline: none;
    background: #584c66;
    padding: 0 19px;
    margin: 0 -19px;

    &:before {
      left: 0;
    }
  }

  ${getActiveStyle};
`;

const SidebarItemWrapper = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
`;

const SidebarItemIcon = styled('span')`
  content: '';
  display: inline-flex;
  width: 32px;
  height: 22px;
  font-size: 20px;
  align-items: center;

  svg {
    display: block;
    margin: 0 auto;
  }
`;

const SidebarItemLabel = styled('span')`
  margin-left: 12px;
  white-space: nowrap;
  opacity: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const getCollapsedBadgeStyle = ({collapsed, theme}) => {
  if (!collapsed) {
    return '';
  }

  return css`
    text-indent: -99999em;
    position: absolute;
    right: 0;
    top: 1px;
    background: ${theme.red};
    width: ${theme.sidebar.smallBadgeSize};
    height: ${theme.sidebar.smallBadgeSize};
    border-radius: ${theme.sidebar.smallBadgeSize};
    line-height: ${theme.sidebar.smallBadgeSize};
    box-shadow: 0 3px 3px ${theme.sidebar.background};
  `;
};

const SidebarItemBadge = styled(({collapsed: _, ...props}) => <span {...props} />)`
  display: block;
  text-align: center;
  color: ${p => p.theme.white};
  font-size: 12px;
  background: ${p => p.theme.red};
  width: ${p => p.theme.sidebar.badgeSize};
  height: ${p => p.theme.sidebar.badgeSize};
  border-radius: ${p => p.theme.sidebar.badgeSize};
  line-height: ${p => p.theme.sidebar.badgeSize};

  ${getCollapsedBadgeStyle};
`;
