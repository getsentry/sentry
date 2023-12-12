import {Fragment, isValidElement, useCallback, useMemo} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import FeatureBadge from 'sentry/components/featureBadge';
import HookOrDefault from 'sentry/components/hookOrDefault';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {Flex} from 'sentry/components/profiling/flex';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import localStorage from 'sentry/utils/localStorage';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {SidebarOrientation} from './types';
import {SIDEBAR_NAVIGATION_SOURCE} from './utils';

const LabelHook = HookOrDefault({
  hookName: 'sidebar:item-label',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

const tooltipDisabledProps = {
  disabled: true,
};

export type SidebarItemProps = {
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
   * Whether to use exact matching to detect active paths. If true, this item will only
   * be active if the current router path exactly matches the `to` prop. If false
   * (default), there will be a match for any router path that _starts with_ the `to`
   * prop.
   */
  exact?: boolean;
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
   * Specify the variant for the badge.
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
  search?: string;
  to?: string;
  /**
   * Content to render at the end of the item.
   */
  trailingItems?: React.ReactNode;
  /**
   * Content to render at the end of the item.
   */
  variant?: 'badge' | 'indicator' | 'short' | undefined;
};

function SidebarItem({
  id,
  href,
  to,
  search,
  icon,
  label,
  badge,
  active,
  exact,
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
  trailingItems,
  variant,
  ...props
}: SidebarItemProps) {
  const router = useRouter();
  // label might be wrapped in a guideAnchor
  let labelString = label;
  if (isValidElement(label)) {
    labelString = label?.props?.children ?? label;
  }
  // If there is no active panel open and if path is active according to react-router
  const isActiveRouter =
    !hasPanel && router && isItemActive({to, label: labelString}, exact);

  const isActive = defined(active) ? active : isActiveRouter;
  const isTop = orientation === 'top';
  const placement = isTop ? 'bottom' : 'right';

  const seenSuffix = isNewSeenKeySuffix ?? '';
  const isNewSeenKey = `sidebar-new-seen:${id}${seenSuffix}`;
  const showIsNew = isNew && !localStorage.getItem(isNewSeenKey);

  const recordAnalytics = useCallback(() => {
    trackAnalytics('growth.clicked_sidebar', {
      item: id,
      organization: organization || null,
    });
  }, [id, organization]);

  const toProps: LocationDescriptor = useMemo(() => {
    return {
      pathname: to ? to : href ?? '#',
      search,
      state: {source: SIDEBAR_NAVIGATION_SOURCE},
    };
  }, [to, href, search]);

  const badges = (
    <Fragment>
      {showIsNew && <FeatureBadge type="new" variant={variant} />}
      {isBeta && <FeatureBadge type="beta" variant={variant} />}
      {isAlpha && <FeatureBadge type="alpha" variant={variant} />}
    </Fragment>
  );

  const handleItemClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      !(to || href) && event.preventDefault();
      recordAnalytics();
      onClick?.(id, event);
      showIsNew && localStorage.setItem(isNewSeenKey, 'true');
    },
    [href, to, id, onClick, recordAnalytics, showIsNew, isNewSeenKey]
  );

  return (
    <Tooltip
      disabled={!collapsed && !isTop}
      title={
        <Flex align="center">
          {label} {badges}
        </Flex>
      }
      position={placement}
    >
      <StyledSidebarItem
        {...props}
        id={`sidebar-item-${id}`}
        active={isActive ? 'true' : undefined}
        to={toProps}
        className={className}
        onClick={handleItemClick}
      >
        <InteractionStateLayer isPressed={isActive} color="white" higherOpacity />
        <SidebarItemWrapper collapsed={collapsed}>
          <SidebarItemIcon>{icon}</SidebarItemIcon>
          {!collapsed && !isTop && (
            <SidebarItemLabel>
              <LabelHook id={id}>
                <TextOverflow>{label}</TextOverflow>
                {badges}
              </LabelHook>
            </SidebarItemLabel>
          )}
          {collapsed && showIsNew && (
            <CollapsedFeatureBadge
              type="new"
              variant="indicator"
              tooltipProps={tooltipDisabledProps}
            />
          )}
          {collapsed && isBeta && (
            <CollapsedFeatureBadge
              type="beta"
              variant="indicator"
              tooltipProps={tooltipDisabledProps}
            />
          )}
          {collapsed && isAlpha && (
            <CollapsedFeatureBadge
              type="alpha"
              variant="indicator"
              tooltipProps={tooltipDisabledProps}
            />
          )}
          {badge !== undefined && badge > 0 && (
            <SidebarItemBadge collapsed={collapsed}>{badge}</SidebarItemBadge>
          )}
          {trailingItems}
        </SidebarItemWrapper>
      </StyledSidebarItem>
    </Tooltip>
  );
}

export function isItemActive(
  item: Pick<SidebarItemProps, 'to' | 'label'>,
  exact?: boolean
): boolean {
  // take off the query params for matching
  const toPathWithoutReferrer = item?.to?.split('?')[0];
  if (!toPathWithoutReferrer) {
    return false;
  }

  return (
    (exact
      ? location.pathname === normalizeUrl(toPathWithoutReferrer)
      : location.pathname.startsWith(normalizeUrl(toPathWithoutReferrer))) ||
    (item?.label === 'Discover' && location.pathname.includes('/discover/')) ||
    (item?.label === 'Dashboards' &&
      (location.pathname.includes('/dashboards/') ||
        location.pathname.includes('/dashboard/')) &&
      !location.pathname.startsWith('/settings/')) ||
    // TODO: this won't be necessary once we remove settingsHome
    (item?.label === 'Settings' && location.pathname.startsWith('/settings/')) ||
    (item?.label === 'Alerts' &&
      location.pathname.includes('/alerts/') &&
      !location.pathname.startsWith('/settings/')) ||
    (item?.label === 'Releases' && location.pathname.includes('/release-thresholds/'))
  );
}

export default SidebarItem;

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

const StyledSidebarItem = styled(Link, {
  shouldForwardProp: p => typeof p === 'string' && isPropValid(p),
})`
  display: flex;
  color: inherit;
  position: relative;
  cursor: pointer;
  font-size: 15px;
  height: 30px;
  flex-shrink: 0;
  border-radius: ${p => p.theme.borderRadius};
  transition: none;

  &:before {
    display: block;
    content: '';
    position: absolute;
    top: 4px;
    left: calc(-${space(2)} - 1px);
    bottom: 6px;
    width: 5px;
    border-radius: 0 3px 3px 0;
    background-color: transparent;
    transition: 0.15s background-color linear;
  }

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    &:before {
      top: auto;
      left: 5px;
      bottom: -12px;
      height: 5px;
      width: auto;
      right: 5px;
      border-radius: 3px 3px 0 0;
    }
  }

  &:hover,
  &.focus-visible {
    color: ${p => p.theme.white};
  }

  &:focus {
    outline: none;
  }

  &.focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.purple300};
  }

  ${getActiveStyle};
`;

const SidebarItemWrapper = styled('div')<{collapsed?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;

  ${p => !p.collapsed && `padding-right: ${space(1)};`}
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding-right: 0;
  }
`;

const SidebarItemIcon = styled('span')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 37px;

  svg {
    display: block;
    margin: 0 auto;
    width: 18px;
    height: 18px;
  }
`;

const SidebarItemLabel = styled('span')`
  margin-left: 10px;
  white-space: nowrap;
  opacity: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
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
  top: 2px;
  right: 2px;
`;
