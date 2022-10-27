import {Fragment, isValidElement} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import Tooltip from 'sentry/components/tooltip';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import localStorage from 'sentry/utils/localStorage';
import {Theme} from 'sentry/utils/theme';

import {SidebarOrientation} from './types';

const LabelHook = HookOrDefault({
  hookName: 'sidebar:item-label',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

type Props = WithRouterProps & {
  /**
   * Icon to display
   */
  icon: React.ReactNode;
  /**
   * Key of the sidebar item. Used for label hooks
   */
  id: string;
  /**
   * Label to display (only when expanded)
   */
  label: React.ReactNode;
  /**
   * Sidebar is at "top" or "left" of screen
   */
  orientation: SidebarOrientation;
  /**
   * Is this sidebar item active
   */
  active?: boolean;

  /**
   * Additional badge to display after label
   */
  badge?: number;
  className?: string;
  /**
   * Is sidebar in a collapsed state
   */
  collapsed?: boolean;
  /**
   * Sidebar has a panel open
   */
  hasPanel?: boolean;
  href?: string;
  index?: boolean;
  /**
   * Additional badge letting users know a tab is in alpha.
   */
  isAlpha?: boolean;
  /**
   * Additional badge letting users know a tab is in beta.
   */
  isBeta?: boolean;
  /**
   * Additional badge letting users know a tab is new.
   */
  isNew?: boolean;
  /**
   * An optional prefix that can be used to reset the "new" indicator
   */
  isNewSeenKeySuffix?: string;
  onClick?: (id: string, e: React.MouseEvent<HTMLAnchorElement>) => void;
  /**
   * The current organization. Useful for analytics.
   */
  organization?: Organization;

  to?: string;
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
  isBeta,
  isAlpha,
  collapsed,
  className,
  orientation,
  isNewSeenKeySuffix,
  organization,
  onClick,
  ...props
}: Props) => {
  // label might be wrapped in a guideAnchor
  let labelString = label;
  if (isValidElement(label)) {
    labelString = label?.props?.children ?? label;
  }
  // take off the query params for matching
  const toPathWithourReferrer = to?.split('?')[0];
  // If there is no active panel open and if path is active according to react-router
  const isActiveRouter =
    (!hasPanel &&
      router &&
      toPathWithourReferrer &&
      location.pathname.startsWith(toPathWithourReferrer)) ||
    (labelString === 'Discover' && location.pathname.includes('/discover/')) ||
    (labelString === 'Dashboards' &&
      (location.pathname.includes('/dashboards/') ||
        location.pathname.includes('/dashboard/')) &&
      !location.pathname.startsWith('/settings/')) ||
    // TODO: this won't be necessary once we remove settingsHome
    (labelString === 'Settings' && location.pathname.startsWith('/settings/')) ||
    (labelString === 'Alerts' &&
      location.pathname.includes('/alerts/') &&
      !location.pathname.startsWith('/settings/'));

  const isActive = active || isActiveRouter;
  const isTop = orientation === 'top';
  const placement = isTop ? 'bottom' : 'right';

  const seenSuffix = isNewSeenKeySuffix ?? '';
  const isNewSeenKey = `sidebar-new-seen:${id}${seenSuffix}`;
  const showIsNew = isNew && !localStorage.getItem(isNewSeenKey);

  const recordAnalytics = () => {
    trackAdvancedAnalyticsEvent('growth.clicked_sidebar', {
      item: id,
      organization: organization || null,
    });
  };

  const badges = (
    <Fragment>
      {showIsNew && <FeatureBadge type="new" noTooltip />}
      {isBeta && <FeatureBadge type="beta" noTooltip />}
      {isAlpha && <FeatureBadge type="alpha" noTooltip />}
    </Fragment>
  );

  const tooltipLabel = (
    <Fragment>
      {label} {badges}
    </Fragment>
  );

  return (
    <Tooltip disabled={!collapsed} title={tooltipLabel} position={placement}>
      <StyledSidebarItem
        data-test-id={props['data-test-id']}
        id={`sidebar-item-${id}`}
        active={isActive ? 'true' : undefined}
        to={(to ? to : href) || '#'}
        className={className}
        onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
          !(to || href) && event.preventDefault();
          recordAnalytics();
          onClick?.(id, event);
          showIsNew && localStorage.setItem(isNewSeenKey, 'true');
        }}
      >
        <SidebarItemWrapper>
          <SidebarItemIcon>{icon}</SidebarItemIcon>
          {!collapsed && !isTop && (
            <SidebarItemLabel>
              <LabelHook id={id}>
                <TextOverflow>{label}</TextOverflow>
                {badges}
              </LabelHook>
            </SidebarItemLabel>
          )}
          {collapsed && showIsNew && <CollapsedFeatureBadge type="new" />}
          {collapsed && isBeta && <CollapsedFeatureBadge type="beta" />}
          {collapsed && isAlpha && <CollapsedFeatureBadge type="alpha" />}
          {badge !== undefined && badge > 0 && (
            <SidebarItemBadge collapsed={collapsed}>{badge}</SidebarItemBadge>
          )}
        </SidebarItemWrapper>
      </StyledSidebarItem>
    </Tooltip>
  );
};

export default withRouter(SidebarItem);

const getActiveStyle = ({active, theme}: {active?: string; theme?: Theme}) => {
  if (!active) {
    return '';
  }
  return css`
    color: ${theme?.white};

    &:active,
    &:focus,
    &:hover {
      color: ${theme?.white};
    }

    &:before {
      background-color: ${theme?.active};
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

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
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
    color: ${p => p.theme.white};
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
  flex-shrink: 0;

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
    background: ${theme.red300};
    width: ${theme.sidebar.smallBadgeSize};
    height: ${theme.sidebar.smallBadgeSize};
    border-radius: ${theme.sidebar.smallBadgeSize};
    line-height: ${theme.sidebar.smallBadgeSize};
    box-shadow: ${theme.sidebar.boxShadow};
  `;
};

const SidebarItemBadge = styled(({collapsed: _, ...props}) => <span {...props} />)`
  display: block;
  text-align: center;
  color: ${p => p.theme.white};
  font-size: 12px;
  background: ${p => p.theme.red300};
  width: ${p => p.theme.sidebar.badgeSize};
  height: ${p => p.theme.sidebar.badgeSize};
  border-radius: ${p => p.theme.sidebar.badgeSize};
  line-height: ${p => p.theme.sidebar.badgeSize};

  ${getCollapsedBadgeStyle};
`;

const CollapsedFeatureBadge = styled(FeatureBadge)`
  position: absolute;
  top: 0;
  right: 0;
`;

CollapsedFeatureBadge.defaultProps = {
  variant: 'indicator',
  noTooltip: true,
};
