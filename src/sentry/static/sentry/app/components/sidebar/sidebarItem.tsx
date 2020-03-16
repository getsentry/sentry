import * as ReactRouter from 'react-router';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import Tag from 'app/views/settings/components/tag';
import HookOrDefault from 'app/components/hookOrDefault';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Link from 'app/components/links/link';
import TextOverflow from 'app/components/textOverflow';

import {SidebarOrientation} from './types';

const LabelHook = HookOrDefault({
  hookName: 'sidebar:item-label',
  defaultComponent: ({children}) => <React.Fragment>{children}</React.Fragment>,
});

type Props = ReactRouter.WithRouterProps & {
  onClick?: (id: string, e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;

  // TODO(ts): Replace with React.ComponentProps<typeof Link> when possible
  index?: boolean;
  href?: string;
  to?: string;

  /**
   * Key of the sidebar item. Used for label hooks
   */
  id: string;
  /**
   * Is this sidebar item active
   */
  active?: boolean;
  /**
   * Is sidebar in a collapsed state
   */
  collapsed?: boolean;
  /**
   * Sidebar has a panel open
   */
  hasPanel?: boolean;
  /**
   * Icon to display
   */
  icon: React.ReactNode;
  /**
   * Label to display (only when expanded)
   */
  label: React.ReactNode;
  /**
   * Additional badge to display after label
   */
  badge?: number;
  /**
   * Additional badge letting users know a tab is new.
   */
  isNew?: boolean;
  /**
   * Sidebar is at "top" or "left" of screen
   */
  orientation: SidebarOrientation;
};

const SidebarItem = ({
  router,
  id,
  href,
  to,
  icon,
  label,
  badge,
  active,
  hasPanel,
  isNew,
  collapsed,
  className,
  orientation,
  onClick,
  ...props
}: Props) => {
  // If there is no active panel open and if path is active according to react-router
  const isActiveRouter =
    (!hasPanel && router && to && location.pathname.startsWith(to)) ||
    (label === 'Discover' && location.pathname.includes('/discover/')) ||
    // TODO: this won't be necessary once we remove settingsHome
    (label === 'Settings' && location.pathname.startsWith('/settings/'));

  const isActive = active || isActiveRouter;
  const isTop = orientation === 'top';
  const placement = isTop ? 'bottom' : 'right';

  return (
    <Tooltip disabled={!collapsed} title={label} position={placement}>
      <StyledSidebarItem
        data-test-id={props['data-test-id']}
        active={isActive ? 'true' : undefined}
        href={href}
        to={to}
        className={className}
        onClick={(e: React.MouseEvent<HTMLAnchorElement>) =>
          typeof onClick === 'function' && onClick(id, e)
        }
      >
        <SidebarItemWrapper>
          <SidebarItemIcon>{icon}</SidebarItemIcon>
          {!collapsed && !isTop && (
            <SidebarItemLabel>
              <LabelHook id={id}>
                <TextOverflow>{label}</TextOverflow>
                {isNew && (
                  <StyledTag priority="beta" size="small">
                    {t('New')}
                  </StyledTag>
                )}
              </LabelHook>
            </SidebarItemLabel>
          )}
          {badge !== undefined && badge > 0 && (
            <SidebarItemBadge collapsed={collapsed}>{badge}</SidebarItemBadge>
          )}
        </SidebarItemWrapper>
      </StyledSidebarItem>
    </Tooltip>
  );
};

export default ReactRouter.withRouter(SidebarItem);

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

const StyledTag = styled(Tag)`
  font-weight: normal;
  padding: 3px ${space(0.75)};
  margin-left: ${space(0.5)};
  border-radius: 20px;
`;
