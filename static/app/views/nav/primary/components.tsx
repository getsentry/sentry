import {Fragment, type MouseEventHandler} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {space} from 'sentry/styles/space';
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
  children?: React.ReactNode;
}

interface SidebarItemDropdownProps {
  analyticsKey: string;
  items: MenuItemProps[];
  label: string;
  children?: React.ReactNode;
  disableTooltip?: boolean;
  onOpen?: MouseEventHandler<HTMLButtonElement>;
  triggerWrap?: React.ComponentType<{children: React.ReactNode}>;
}

interface SidebarButtonProps {
  analyticsKey: string;
  children: React.ReactNode;
  label: string;
  buttonProps?: Omit<ButtonProps, 'aria-label'>;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

function recordPrimaryItemClick(analyticsKey: string, organization: Organization) {
  trackAnalytics('navigation.primary_item_clicked', {
    item: analyticsKey,
    organization,
  });
}

interface SidebarItemProps extends React.HTMLAttributes<HTMLLIElement> {
  children: React.ReactNode;
  label: string;
  showLabel: boolean;
  disableTooltip?: boolean;
}

function SidebarItem({
  children,
  label,
  showLabel,
  disableTooltip,
  ...props
}: SidebarItemProps) {
  const {layout} = useNavContext();
  return (
    <IconDefaultsProvider legacySize={layout === NavLayout.MOBILE ? '16px' : '21px'}>
      <Tooltip
        title={label}
        disabled={showLabel || disableTooltip}
        position="right"
        skipWrapper
        delay={0}
      >
        <SidebarListItem {...props}>{children}</SidebarListItem>
      </Tooltip>
    </IconDefaultsProvider>
  );
}

function SidebarItemIcon({
  children,
  layout,
}: {
  children: React.ReactNode;
  layout: NavLayout;
}) {
  return (
    <IconDefaultsProvider legacySize={layout === NavLayout.MOBILE ? '16px' : '21px'}>
      {children}
    </IconDefaultsProvider>
  );
}

export function SidebarMenu({
  items,
  children,
  analyticsKey,
  label,
  onOpen,
  disableTooltip,
  triggerWrap: TriggerWrap = Fragment,
}: SidebarItemDropdownProps) {
  // This component can be rendered without an organization in some cases
  const organization = useOrganization({allowNull: true});
  const {layout} = useNavContext();

  const showLabel = layout === NavLayout.MOBILE;

  return (
    <DropdownMenu
      position={layout === NavLayout.MOBILE ? 'bottom' : 'right-end'}
      shouldApplyMinWidth={false}
      minMenuWidth={200}
      trigger={props => {
        return (
          <SidebarItem
            label={label}
            showLabel={showLabel}
            disableTooltip={disableTooltip}
          >
            <TriggerWrap>
              <NavButton
                {...props}
                aria-label={showLabel ? undefined : label}
                onClick={event => {
                  if (organization) {
                    recordPrimaryItemClick(analyticsKey, organization);
                  }
                  props.onClick?.(event);
                  onOpen?.(event);
                }}
                isMobile={layout === NavLayout.MOBILE}
                icon={
                  showLabel ? (
                    <SidebarItemIcon layout={layout}>{children}</SidebarItemIcon>
                  ) : null
                }
              >
                {showLabel ? label : children}
              </NavButton>
            </TriggerWrap>
          </SidebarItem>
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
        recordPrimaryItemClick(analyticsKey, organization);
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
  group,
  ...props
}: SidebarItemLinkProps) {
  const label = PRIMARY_NAV_GROUP_CONFIG[group].label;

  return (
    <SidebarItem label={label} showLabel {...props}>
      <SidebarNavLink
        to={to}
        activeTo={activeTo}
        analyticsKey={analyticsKey}
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
  children,
  buttonProps = {},
  onClick,
  label,
}: SidebarButtonProps) {
  const organization = useOrganization();
  const {layout} = useNavContext();
  const showLabel = layout === NavLayout.MOBILE;

  return (
    <SidebarItem label={label} showLabel={showLabel} className={className}>
      <NavButton
        {...buttonProps}
        isMobile={layout === NavLayout.MOBILE}
        aria-label={showLabel ? undefined : label}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          recordPrimaryItemClick(analyticsKey, organization);
          buttonProps.onClick?.(e);
          onClick?.(e);
        }}
        icon={
          showLabel ? <SidebarItemIcon layout={layout}>{children}</SidebarItemIcon> : null
        }
      >
        {null}
        {showLabel ? label : children}
      </NavButton>
    </SidebarItem>
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

const SidebarListItem = styled('li')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SeparatorListItem = styled('li')<{hasMargin?: boolean}>`
  list-style: none;
  width: 100%;
  padding: 0 ${space(1.5)};
  ${p =>
    p.hasMargin &&
    css`
      margin: ${space(0.5)} 0;
    `}
`;

const Separator = styled('hr')`
  outline: 0;
  border: 0;
  height: 1px;
  background: ${p => p.theme.tokens.border.secondary};
  margin: 0;
`;

const ChonkNavLinkIconContainer = styled('span')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)} ${space(1)};
  border-radius: ${p => p.theme.radius.md};
`;

const NavLinkIconContainer = ChonkNavLinkIconContainer;

const NavLinkLabel = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.bold};
  letter-spacing: -0.05em;
`;

const ChonkNavLink = styled(Link, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{isMobile: boolean}>`
  display: flex;
  position: relative;
  width: 100%;
  flex-direction: ${p => (p.isMobile ? 'row' : 'column')};
  justify-content: ${p => (p.isMobile ? 'flex-start' : 'center')};
  align-items: center;

  padding: ${p =>
    p.isMobile ? `${space(1)} ${space(3)}` : `${space(0.75)} ${space(1.5)}`};

  /* On mobile, the buttons are horizontal, so we need a gap between the icon and label */
  gap: ${p => (p.isMobile ? space(1) : space(0.5))};

  /* Disable default link styles and only apply them to the icon container */
  color: ${p => p.theme.tokens.content.muted};
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
    background-color: ${p => p.theme.tokens.graphics.accent};
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
  }

  /* Apply focus styles only to the icon container */
  &:focus-visible {
    ${NavLinkIconContainer} {
      outline: none;
      box-shadow: 0 0 0 2px ${p => p.theme.focusBorder};
      background-color: ${p => p.theme.colors.blue100};
    }
  }

  &:hover,
  &[aria-selected='true'] {
    color: ${p => p.theme.tokens.content.muted};
    ${NavLinkIconContainer} {
      background-color: ${p => p.theme.colors.gray100};
    }
  }

  &[aria-current='page'] {
    color: ${p => p.theme.tokens.content.accent};

    &::before {
      opacity: 1;
    }
    ${NavLinkIconContainer} {
      background-color: ${p => p.theme.colors.blue100};
    }

    &:hover {
      ${NavLinkIconContainer} {
        background-color: ${p => p.theme.colors.blue100};
      }
    }
  }
`;

const NavLink = ChonkNavLink;

const ChonkNavButton = styled(Button, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{isMobile: boolean}>`
  display: flex;
  align-items: center;

  /* On mobile, the buttons are full width and have a gap between the icon and label */
  justify-content: ${p => (p.isMobile ? 'flex-start' : 'center')};
  height: ${p => (p.isMobile ? 'auto' : '44px')};
  width: ${p => (p.isMobile ? '100%' : '44px')};
  padding: ${p => (p.isMobile ? `${space(1)} ${space(3)}` : space(0.5))};

  svg {
    margin-right: ${p => (p.isMobile ? space(1) : undefined)};
  }

  /* Disable interactionstatelayer hover */
  [data-isl] {
    display: none;
  }
`;

type NavButtonProps = ButtonProps & {
  isMobile: boolean;
};

const NavButton = styled((p: NavButtonProps) => {
  return (
    <ChonkNavButton
      {...p}
      aria-label={p['aria-label'] ?? ''}
      size={p.isMobile ? 'zero' : undefined}
    />
  );
})``;

export const SidebarItemUnreadIndicator = styled('span')<{isMobile: boolean}>`
  position: absolute;
  top: ${p => (p.isMobile ? `8px` : `calc(50% - 12px)`)};
  left: ${p => (p.isMobile ? '36px' : `calc(50% + 14px)`)};
  transform: translate(-50%, -50%);
  display: block;
  text-align: center;
  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSize.xs};
  background: ${p => p.theme.colors.blue500};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid ${p => p.theme.tokens.background.primary};

  ${p =>
    p.isMobile &&
    css`
      top: 5px;
      left: 12px;
    `}
`;

export const SidebarList = styled('ul')<{isMobile: boolean; compact?: boolean}>`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  align-items: ${p => (p.isMobile ? 'stretch' : 'center')};
  gap: ${space(0.5)};
  width: 100%;

  /* TriggerWrap div is getting in the way here */
  > div,
  > div > li,
  > li {
    width: 100%;
  }
`;

export const SidebarFooterWrapper = styled('div')<{isMobile: boolean}>`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: auto;
  margin-bottom: ${p => (p.isMobile ? space(1) : 0)};
`;
