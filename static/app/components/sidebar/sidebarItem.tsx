import {Fragment, isValidElement, useCallback, useContext, useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Flex} from 'sentry/components/container/flex';
import HookOrDefault from 'sentry/components/hookOrDefault';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {ExpandedContext} from 'sentry/components/sidebar/expandedContextProvider';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import localStorage from 'sentry/utils/localStorage';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import type {SidebarOrientation} from './types';
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
  /**
   * Custom tooltip title for the badge
   */
  badgeTitle?: string;
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
  hasNewNav?: boolean;
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
   * Is main item in a floating accordion
   */
  isMainItem?: boolean;
  /**
   * Is this item nested within another item
   */
  isNested?: boolean;
  /**
   * Specify the variant for the badge.
   */
  isNew?: boolean;
  /**
   * An optional prefix that can be used to reset the "new" indicator
   */
  isNewSeenKeySuffix?: string;
  /**
   * Is this item expanded in the floating sidebar
   */
  isOpenInFloatingSidebar?: boolean;
  onClick?: (id: string, e: React.MouseEvent<HTMLAnchorElement>) => void;
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
  onClick,
  trailingItems,
  variant,
  isNested,
  isMainItem,
  isOpenInFloatingSidebar,
  hasNewNav,
  badgeTitle,
  ...props
}: SidebarItemProps) {
  const {setExpandedItemId, shouldAccordionFloat} = useContext(ExpandedContext);
  const router = useRouter();
  // label might be wrapped in a guideAnchor
  let labelString = label;
  if (isValidElement(label)) {
    labelString = label?.props?.children ?? label;
  }
  // If there is no active panel open and if path is active according to react-router
  const isActiveRouter =
    !hasPanel && router && isItemActive({to, label: labelString}, exact);

  // TODO: floating accordion should be transformed into secondary panel
  let isInFloatingAccordion = (isNested || isMainItem) && shouldAccordionFloat;
  if (hasNewNav) {
    isInFloatingAccordion = false;
  }
  const hasLink = Boolean(to);
  const isInCollapsedState = (!isInFloatingAccordion && collapsed) || hasNewNav;

  const isActive = defined(active) ? active : isActiveRouter;
  const isTop = orientation === 'top' && !isInFloatingAccordion;
  const placement = isTop ? 'bottom' : 'right';

  const seenSuffix = isNewSeenKeySuffix ?? '';
  const isNewSeenKey = `sidebar-new-seen:${id}${seenSuffix}`;
  const showIsNew =
    isNew && !localStorage.getItem(isNewSeenKey) && !(isInFloatingAccordion && !hasLink);

  const organization = useOrganization({allowNull: true});

  const recordAnalytics = useCallback(
    () => trackAnalytics('growth.clicked_sidebar', {item: id, organization}),
    [id, organization]
  );

  const toProps: LocationDescriptor = useMemo(() => {
    if (!to && !href) {
      return '#';
    }
    return {
      pathname: to ? to : href,
      search,
    };
  }, [to, href, search]);

  const badges = (
    <Fragment>
      {showIsNew && <FeatureBadge type="new" variant={variant} title={badgeTitle} />}
      {isBeta && <FeatureBadge type="beta" variant={variant} title={badgeTitle} />}
      {isAlpha && <FeatureBadge type="alpha" variant={variant} title={badgeTitle} />}
    </Fragment>
  );

  const handleItemClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      setExpandedItemId(null);
      if (!to && !href) {
        event.preventDefault();
      }
      recordAnalytics();
      onClick?.(id, event);
      if (showIsNew) {
        localStorage.setItem(isNewSeenKey, 'true');
      }
    },
    [href, to, id, onClick, recordAnalytics, showIsNew, isNewSeenKey, setExpandedItemId]
  );

  return (
    <Tooltip
      disabled={
        (!isInCollapsedState && !isTop) ||
        (shouldAccordionFloat && isOpenInFloatingSidebar) ||
        hasNewNav
      }
      title={
        <Flex align="center">
          {label} {badges}
        </Flex>
      }
      position={placement}
    >
      <SidebarNavigationItemHook id={id}>
        {({additionalContent}) => (
          <StyledSidebarItem
            {...props}
            id={`sidebar-item-${id}`}
            isInFloatingAccordion={isInFloatingAccordion}
            active={isActive ? 'true' : undefined}
            to={toProps}
            state={{source: SIDEBAR_NAVIGATION_SOURCE}}
            disabled={!hasLink && isInFloatingAccordion}
            className={className}
            aria-current={isActive ? 'page' : undefined}
            onClick={handleItemClick}
            hasNewNav={hasNewNav}
          >
            {hasNewNav ? (
              <StyledInteractionStateLayer
                isPressed={isActive}
                color="white"
                higherOpacity
              />
            ) : (
              <InteractionStateLayer isPressed={isActive} color="white" higherOpacity />
            )}
            <SidebarItemWrapper collapsed={isInCollapsedState} hasNewNav={hasNewNav}>
              {!isInFloatingAccordion && (
                <SidebarItemIcon hasNewNav={hasNewNav}>{icon}</SidebarItemIcon>
              )}
              {!isInCollapsedState && !isTop && (
                <SidebarItemLabel
                  isInFloatingAccordion={isInFloatingAccordion}
                  isNested={isNested}
                >
                  <LabelHook id={id}>
                    <TruncatedLabel>{label}</TruncatedLabel>
                    {additionalContent ?? badges}
                  </LabelHook>
                </SidebarItemLabel>
              )}
              {isInCollapsedState && showIsNew && (
                <CollapsedFeatureBadge
                  type="new"
                  variant="indicator"
                  tooltipProps={tooltipDisabledProps}
                />
              )}
              {isInCollapsedState && isBeta && (
                <CollapsedFeatureBadge
                  type="beta"
                  variant="indicator"
                  tooltipProps={tooltipDisabledProps}
                />
              )}
              {isInCollapsedState && isAlpha && (
                <CollapsedFeatureBadge
                  type="alpha"
                  variant="indicator"
                  tooltipProps={tooltipDisabledProps}
                />
              )}
              {badge !== undefined && badge > 0 && (
                <SidebarItemBadge collapsed={isInCollapsedState}>
                  {badge}
                </SidebarItemBadge>
              )}
              {!isInFloatingAccordion && hasNewNav && (
                <LabelHook id={id}>
                  <TruncatedLabel hasNewNav={hasNewNav}>{label}</TruncatedLabel>
                  {additionalContent ?? badges}
                </LabelHook>
              )}
              {trailingItems}
            </SidebarItemWrapper>
          </StyledSidebarItem>
        )}
      </SidebarNavigationItemHook>
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
    (item?.label === 'Releases' && location.pathname.includes('/release-thresholds/')) ||
    (item?.label === 'Performance' &&
      location.pathname.startsWith('/performance/') &&
      !location.pathname.startsWith('/settings/'))
  );
}

const SidebarNavigationItemHook = HookOrDefault({
  hookName: 'sidebar:navigation-item',
  defaultComponent: ({children}) =>
    children({
      disabled: false,
      additionalContent: null,
      Wrapper: Fragment,
    }),
});

export default SidebarItem;

const getActiveStyle = ({
  active,
  theme,
  isInFloatingAccordion,
}: {
  active?: string;
  hasNewNav?: boolean;
  isInFloatingAccordion?: boolean;
  theme?: Theme;
}) => {
  if (!active) {
    return '';
  }
  if (isInFloatingAccordion) {
    return css`
      &:active,
      &:focus,
      &:hover {
        color: ${theme?.gray400};
      }
    `;
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
  shouldForwardProp: p =>
    !['isInFloatingAccordion', 'hasNewNav', 'index', 'organization'].includes(p),
})`
  display: flex;
  color: ${p => (p.isInFloatingAccordion ? p.theme.gray400 : 'inherit')};
  position: relative;
  cursor: pointer;
  font-size: 15px;
  height: ${p => (p.isInFloatingAccordion ? '35px' : p.hasNewNav ? '40px' : '30px')};
  flex-shrink: 0;
  border-radius: ${p => p.theme.borderRadius};
  transition: none;
  ${p => {
    if (!p.hasNewNav) {
      return css`
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
      `;
    }
    return css`
      margin: ${space(2)} 0;
      width: 100px;
      align-self: center;
    `;
  }}

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
  &:focus-visible {
    ${p => {
      if (p.isInFloatingAccordion) {
        return css`
          background-color: ${p.theme.hover};
          color: ${p.theme.gray400};
        `;
      }
      return css`
        color: ${p.theme.white};
      `;
    }}
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.purple300};
  }

  ${getActiveStyle};
`;

const SidebarItemWrapper = styled('div')<{collapsed?: boolean; hasNewNav?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  ${p => p.hasNewNav && 'flex-direction: column;'}
  width: 100%;

  ${p => !p.collapsed && `padding-right: ${space(1)};`}
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding-right: 0;
  }
`;

const SidebarItemIcon = styled('span')<{hasNewNav?: boolean}>`
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
  ${p =>
    p.hasNewNav &&
    css`
      @media (max-width: ${p.theme.breakpoints.medium}) {
        display: none;
      }
    `};
`;

const SidebarItemLabel = styled('span')<{
  isInFloatingAccordion?: boolean;
  isNested?: boolean;
}>`
  margin-left: ${p => (p.isNested && p.isInFloatingAccordion ? space(4) : '10px')};
  white-space: nowrap;
  opacity: 1;
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const TruncatedLabel = styled(TextOverflow)<{hasNewNav?: boolean}>`
  ${p =>
    !p.hasNewNav &&
    css`
      margin-right: auto;
    `}
`;

const getCollapsedBadgeStyle = ({collapsed, theme}: any) => {
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

// @ts-ignore TS(7031): Binding element '_' implicitly has an 'any' type.
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

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  height: ${16 * 2 + 40}px;
  width: 70px;
`;
