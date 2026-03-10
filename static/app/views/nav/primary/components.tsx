import {Fragment, useEffect, useRef, type MouseEventHandler} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  NAV_PRIMARY_LINK_DATA_ATTRIBUTE,
  SIDEBAR_NAVIGATION_SOURCE,
} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import type {PrimaryNavGroup} from 'sentry/views/nav/types';
import {NavLayout} from 'sentry/views/nav/types';
import {isLinkActive} from 'sentry/views/nav/utils';

interface SidebarItemLinkProps {
  analyticsKey: string;
  group: PrimaryNavGroup;
  to: string;
  activeTo?: string;
  analyticsParams?: Record<string, unknown>;
  children?: React.ReactNode;
}

interface SidebarItemDropdownProps {
  analyticsKey: string;
  items: MenuItemProps[];
  label: string;
  analyticsParams?: Record<string, unknown>;
  children?: React.ReactNode;
  disableTooltip?: boolean;
  icon?: React.ReactNode;
  onOpen?: MouseEventHandler<HTMLButtonElement>;
  triggerWrap?: React.ComponentType<{children: React.ReactNode}>;
}

interface SidebarButtonProps {
  analyticsKey: string;
  label: string;
  analyticsParams?: Record<string, unknown>;
  buttonProps?: Omit<ButtonProps, 'aria-label'>;
  children?: React.ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

function recordPrimaryItemClick(
  analyticsKey: string,
  organization: Organization,
  analyticsParams?: Record<string, unknown>
) {
  trackAnalytics('navigation.primary_item_clicked', {
    item: analyticsKey,
    organization,
    ...analyticsParams,
  });
}

interface SidebarItemProps extends React.HTMLAttributes<HTMLLIElement> {
  children: React.ReactNode;
  label: string;
  disableTooltip?: boolean;
  ref?: React.Ref<HTMLLIElement>;
}

function SidebarItem({children, label, disableTooltip, ref, ...props}: SidebarItemProps) {
  const {layout} = useNavContext();
  return (
    <IconDefaultsProvider legacySize={layout === NavLayout.MOBILE ? '16px' : '21px'}>
      <Flex
        as="li"
        ref={ref}
        justify="center"
        align="center"
        width={layout === NavLayout.MOBILE ? '100%' : undefined}
        {...props}
      >
        <Tooltip
          title={label}
          disabled={layout === NavLayout.MOBILE || disableTooltip}
          position="right"
          skipWrapper
          delay={600}
        >
          {children}
        </Tooltip>
      </Flex>
    </IconDefaultsProvider>
  );
}

// Stable module-level component to avoid remounts when used as `renderWrapAs`
function PassthroughWrapper({children}: {children: React.ReactNode}) {
  return children;
}

export function SidebarMenu({
  items,
  children,
  analyticsKey,
  analyticsParams,
  label,
  onOpen,
  disableTooltip,
  icon,
  triggerWrap: TriggerWrap = Fragment,
}: SidebarItemDropdownProps) {
  // This component can be rendered without an organization in some cases
  const organization = useOrganization({allowNull: true});
  const {layout} = useNavContext();
  const theme = useTheme();

  const showLabel = layout === NavLayout.MOBILE;
  const portalContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  return (
    <DropdownMenu
      usePortal
      portalContainerRef={portalContainerRef}
      zIndex={theme.zIndex.sidebarDropdownMenu}
      renderWrapAs={PassthroughWrapper}
      position={layout === NavLayout.MOBILE ? 'bottom' : 'right-end'}
      shouldApplyMinWidth={false}
      minMenuWidth={200}
      trigger={triggerProps => {
        return (
          <TriggerWrap>
            <Tooltip
              title={label}
              disabled={showLabel || disableTooltip}
              position="right"
              skipWrapper
              delay={600}
            >
              <NavButton
                {...triggerProps}
                isMobile={layout === NavLayout.MOBILE}
                aria-label={showLabel ? undefined : label}
                onClick={event => {
                  if (organization) {
                    recordPrimaryItemClick(analyticsKey, organization, analyticsParams);
                  }
                  triggerProps.onClick?.(event);
                  onOpen?.(event);
                }}
                icon={icon}
              >
                {showLabel ? label : null}
                {children}
              </NavButton>
            </Tooltip>
          </TriggerWrap>
        );
      }}
      items={items}
    />
  );
}

function SidebarNavLink({
  children,
  to,
  activeTo = to,
  analyticsKey,
  analyticsParams,
  group,
}: SidebarItemLinkProps) {
  const organization = useOrganization();
  const {layout, activePrimaryNavGroup} = useNavContext();
  const location = useLocation();
  const isActive = isLinkActive(normalizeUrl(activeTo, location), location.pathname);
  const label = PRIMARY_NAV_GROUP_CONFIG[group].label;

  // Reload the page when the frontend is stale to ensure users get the latest version
  const {state: appState} = useFrontendVersion();

  return (
    <NavLink
      to={to}
      reloadDocument={appState === 'stale'}
      state={{source: SIDEBAR_NAVIGATION_SOURCE}}
      aria-selected={activePrimaryNavGroup === group ? true : isActive}
      aria-current={isActive ? 'page' : undefined}
      isMobile={layout === NavLayout.MOBILE}
      onClick={() => {
        recordPrimaryItemClick(analyticsKey, organization, analyticsParams);
      }}
      {...{
        [NAV_PRIMARY_LINK_DATA_ATTRIBUTE]: true,
      }}
    >
      {layout === NavLayout.MOBILE ? (
        <Fragment>
          {children}
          {label}
        </Fragment>
      ) : (
        <Fragment>
          <NavLinkIconContainer>{children}</NavLinkIconContainer>
          <NavLinkLabel>{label}</NavLinkLabel>
        </Fragment>
      )}
    </NavLink>
  );
}

export function SidebarLink({
  children,
  to,
  activeTo = to,
  analyticsKey,
  analyticsParams,
  group,
  ...props
}: SidebarItemLinkProps) {
  const label = PRIMARY_NAV_GROUP_CONFIG[group].label;

  return (
    <SidebarItem label={label} {...props}>
      <SidebarNavLink
        to={to}
        activeTo={activeTo}
        analyticsKey={analyticsKey}
        analyticsParams={analyticsParams}
        group={group}
      >
        {children}
      </SidebarNavLink>
    </SidebarItem>
  );
}

export function SidebarButton({
  className,
  analyticsKey,
  analyticsParams,
  children,
  buttonProps = {},
  onClick,
  label,
}: SidebarButtonProps) {
  const organization = useOrganization();
  const {layout} = useNavContext();
  const showLabel = layout === NavLayout.MOBILE;

  return (
    <Tooltip title={label} disabled={showLabel} position="right" skipWrapper delay={600}>
      <NavButton
        {...buttonProps}
        isMobile={layout === NavLayout.MOBILE}
        analyticsParams={analyticsParams}
        className={className}
        aria-label={showLabel ? undefined : label}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          recordPrimaryItemClick(analyticsKey, organization, analyticsParams);
          buttonProps.onClick?.(e);
          onClick?.(e);
        }}
        icon={buttonProps.icon}
      >
        {showLabel ? label : null}
        {children}
      </NavButton>
    </Tooltip>
  );
}

export function SeparatorItem({
  className,
  hasMargin,
}: {
  className?: string;
  hasMargin?: boolean;
}) {
  return (
    <SeparatorListItem aria-hidden className={className} hasMargin={hasMargin}>
      <Separator />
    </SeparatorListItem>
  );
}

const SeparatorListItem = styled('li')<{hasMargin?: boolean}>`
  list-style: none;
  width: 100%;
  padding: 0 ${p => p.theme.space.lg};
  ${p =>
    p.hasMargin &&
    css`
      margin: ${p.theme.space.xs} 0;
    `}
`;

const Separator = styled('hr')`
  outline: 0;
  border: 0;
  height: 1px;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background: ${p => p.theme.tokens.border.secondary};
  margin: 0;
`;

const NavLinkIconContainer = styled('span')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};
`;

const NavLinkLabel = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  letter-spacing: -0.05em;
`;

const NavLink = styled(Link, {
  shouldForwardProp: prop => prop !== 'isMobile' && prop !== 'size',
})<{isMobile: boolean; size?: ButtonProps['size']}>`
  display: flex;
  position: relative;
  width: 100%;
  flex-direction: ${p => (p.isMobile ? 'row' : 'column')};
  justify-content: ${p => (p.isMobile ? 'flex-start' : 'center')};
  align-items: center;

  padding: ${p =>
    p.isMobile
      ? `${p.theme.space.md} ${p.theme.space['2xl']}`
      : `${p.theme.space.sm} ${p.theme.space.lg}`};

  /* On mobile, the buttons are horizontal, so we need a gap between the icon and label */
  gap: ${p => (p.isMobile ? p.theme.space.md : p.theme.space.xs)};

  /* Disable default link styles and only apply them to the icon container */
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  outline: none;
  box-shadow: none;
  transition: none;

  &:active,
  &:focus-visible {
    outline: none;
    box-shadow: none;
    color: currentColor;
  }

  &::before {
    content: '';
    position: absolute;
    /* We align the active state indicator to the top of the icon container, not to the center of the button */
    top: ${p => (p.isMobile ? '50%' : '12px')};
    transform: ${p => (p.isMobile ? 'translateY(-50%)' : 'none')};
    left: 0px;
    width: 4px;
    height: 20px;
    border-radius: ${p => p.theme.radius['2xs']};
    background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
  }

  /* Apply focus styles only to the icon container */
  &:focus-visible {
    ${NavLinkIconContainer} {
      outline: none;
      box-shadow: 0 0 0 2px ${p => p.theme.tokens.focus.default};
    }
  }

  &:hover,
  &[aria-selected='true'] {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    ${NavLinkIconContainer} {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }

  &[aria-current='page'] {
    color: ${p => p.theme.tokens.interactive.link.accent.rest};

    &::before {
      opacity: 1;
    }
    ${NavLinkIconContainer} {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    }

    &:hover {
      color: ${p => p.theme.tokens.interactive.link.accent.hover} ${NavLinkIconContainer} {
        background-color: ${p =>
          p.theme.tokens.interactive.transparent.accent.selected.background.hover};
      }
    }
  }
`;

const NavButton = styled(
  ({isMobile: _isMobile, ...props}: ButtonProps & {isMobile: boolean}) => {
    const {layout} = useNavContext();

    return (
      <Button
        {...props}
        size={layout === NavLayout.MOBILE ? 'zero' : props.size}
        priority={layout === NavLayout.MOBILE ? 'transparent' : props.priority}
      />
    );
  }
)<{isMobile: boolean}>`
  display: flex;
  align-items: center;

  /* On mobile, the buttons are full width and have a gap between the icon and label */
  justify-content: ${p => (p.isMobile ? 'flex-start' : 'center')};
  height: ${p => (p.isMobile ? 'auto' : p.size === undefined ? '44px' : undefined)};
  width: ${p => (p.isMobile ? '100%' : p.size === undefined ? '44px' : undefined)};
  padding: ${p =>
    p.isMobile
      ? `${p.theme.space.md} ${p.theme.space['2xl']}`
      : p.size === undefined
        ? p.theme.space.xs
        : undefined};

  /* Disable interactionstatelayer hover */
  [data-isl] {
    display: none;
  }

  /* Nav buttons are icon-only; allow icon content to overflow the inner span */
  > span:last-child {
    overflow: visible;
  }

  /* The indicator (SidebarItemUnreadIndicator) is passed as children, which causes
   * Button's internal logic to set hasChildren=true and add margin-right to the icon
   * wrapper. On desktop buttons are icon-only so we override to zero; on mobile the
   * margin-right provides the gap between the icon and label text. */
  ${p =>
    !p.isMobile &&
    css`
      > span:last-child > span:first-child {
        margin-right: 0;
      }
    `}
`;

export const SidebarItemUnreadIndicator = styled('span')<{
  isMobile: boolean;
  variant?: 'accent' | 'danger' | 'warning';
}>`
  position: absolute;
  top: -${p => p.theme.space.xs};
  right: -${p => p.theme.space.md};
  display: block;
  text-align: center;
  color: ${p => p.theme.colors.white};
  font-size: ${p => p.theme.font.size.xs};
  background: ${p => p.theme.tokens.graphics[p.variant ?? 'accent'].vibrant};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid ${p => p.theme.tokens.border[p.variant ?? 'accent'].muted};

  ${p =>
    p.isMobile &&
    css`
      top: -${p.theme.space.xs};
      right: auto;
      left: 11px;
    `}
`;

export const SidebarList = styled('ul')<{isMobile: boolean; compact?: boolean}>`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  padding-top: ${p => p.theme.space.md};
  display: flex;
  flex-direction: column;
  align-items: ${p => (p.isMobile ? 'stretch' : 'center')};
  gap: ${p => p.theme.space.xs};
  width: 100%;

  /* TriggerWrap div is getting in the way here */
  > div,
  > div > li,
  > li {
    width: 100%;
  }
`;
