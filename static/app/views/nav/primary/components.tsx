import {Fragment, type MouseEventHandler, useRef} from 'react';
import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';

import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/components/sidebar/utils';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  NAV_PRIMARY_LINK_DATA_ATTRIBUTE,
  NAV_SIDEBAR_PREVIEW_DELAY_MS,
  PRIMARY_SIDEBAR_WIDTH,
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
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

interface SidebarItemDropdownProps {
  analyticsKey: string;
  items: MenuItemProps[];
  label: string;
  children?: React.ReactNode;
  disableTooltip?: boolean;
  onOpen?: MouseEventHandler<HTMLButtonElement>;
}

interface SidebarButtonProps {
  analyticsKey: string;
  children: React.ReactNode;
  label: string;
  buttonProps?: Omit<ButtonProps, 'aria-label'>;
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
}: SidebarItemDropdownProps) {
  const theme = useTheme();
  // This component can be rendered without an organization in some cases
  const organization = useOrganization({allowNull: true});
  const {layout} = useNavContext();

  const showLabel = layout === NavLayout.MOBILE;

  return (
    <DropdownMenu
      position={layout === NavLayout.MOBILE ? 'bottom' : 'right-end'}
      shouldApplyMinWidth={false}
      minMenuWidth={200}
      trigger={(props, isOpen) => {
        return (
          <SidebarItem
            label={label}
            showLabel={showLabel}
            disableTooltip={disableTooltip}
          >
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
              {theme.isChonk ? null : (
                <InteractionStateLayer hasSelectedBackground={isOpen} />
              )}
              {showLabel ? label : children}
            </NavButton>
          </SidebarItem>
        );
      }}
      items={items}
    />
  );
}

function useActivateNavGroupOnHover(group: PrimaryNavGroup) {
  const {setActivePrimaryNavGroup, isCollapsed, collapsedNavIsOpen} = useNavContext();

  // Slightly delay changing the active nav group to prevent accidentally triggering a new menu
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  return useHover({
    onHoverStart: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (isCollapsed && !collapsedNavIsOpen) {
        setActivePrimaryNavGroup(group);
        return;
      }

      timeoutRef.current = setTimeout(() => {
        setActivePrimaryNavGroup(group);
      }, NAV_SIDEBAR_PREVIEW_DELAY_MS);
    },
    onHoverEnd: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
  });
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
  const theme = useTheme();
  const location = useLocation();
  const isActive = isLinkActive(normalizeUrl(activeTo, location), location.pathname);
  const label = PRIMARY_NAV_GROUP_CONFIG[group].label;
  const {hoverProps} = useActivateNavGroupOnHover(group);

  return (
    <NavLink
      to={to}
      state={{source: SIDEBAR_NAVIGATION_SOURCE}}
      onClick={() => {
        recordPrimaryItemClick(analyticsKey, organization);
      }}
      aria-selected={activePrimaryNavGroup === group ? true : isActive}
      aria-current={isActive ? 'page' : undefined}
      isMobile={layout === NavLayout.MOBILE}
      {...{
        [NAV_PRIMARY_LINK_DATA_ATTRIBUTE]: true,
      }}
      {...hoverProps}
    >
      {layout === NavLayout.MOBILE ? (
        <Fragment>
          {theme.isChonk ? null : <InteractionStateLayer />}
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
}: SidebarItemLinkProps) {
  const label = PRIMARY_NAV_GROUP_CONFIG[group].label;

  return (
    <SidebarItem label={label} showLabel>
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
  analyticsKey,
  children,
  buttonProps = {},
  onClick,
  label,
}: SidebarButtonProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {layout} = useNavContext();
  const showLabel = layout === NavLayout.MOBILE;

  return (
    <SidebarItem label={label} showLabel={showLabel}>
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
        {theme.isChonk ? null : <InteractionStateLayer />}
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
  background: ${p => p.theme.innerBorder};
  margin: 0;
`;

const baseNavItemStyles = (p: {isMobile: boolean; theme: Theme}) => css`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};
  align-items: center;
  padding: ${space(1.5)} ${space(3)};
  color: ${p.theme.textColor};
  font-size: ${p.theme.fontSize.md};
  font-weight: ${p.theme.fontWeight.normal};
  line-height: 1;
  width: 100%;

  &:hover {
    color: ${p.theme.textColor};
  }

  & > * {
    pointer-events: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px ${p.theme.focusBorder};
    color: currentColor;
  }

  ${!p.isMobile &&
  css`
    flex-direction: column;
    justify-content: center;
    border-radius: ${p.theme.borderRadius};
    margin-inline: 0 auto;
    gap: ${space(0.75)};
    padding: ${space(1)} 0;
    min-height: 42px;
    width: 46px;
  `}
`;

const ChonkNavLinkIconContainer = chonkStyled('span')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)} ${space(1)};
  border-radius: ${p => p.theme.radius.md};
`;

const NavLinkIconContainer = withChonk(
  styled('span')`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 42px;
    border-radius: ${p => p.theme.borderRadius};
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: currentColor;
      opacity: 0;
    }
  `,
  ChonkNavLinkIconContainer
);

const NavLinkLabel = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.bold};
  letter-spacing: -0.05em;
`;

const ChonkNavLink = chonkStyled(Link, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{isMobile: boolean}>`
  display: flex;
  position: relative;
  width: 100%;
  flex-direction: ${p => (p.isMobile ? 'row' : 'column')};
  justify-content: ${p => (p.isMobile ? 'flex-start' : 'center')};
  align-items: center;

  padding: ${p => (p.isMobile ? `${space(1)} ${space(3)}` : `${space(0.75)} ${space(1.5)}`)};

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

    &::before { opacity: 1; }
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

const StyledNavLink = styled(Link, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{isMobile: boolean}>`
  ${baseNavItemStyles}
  position: relative;

  ${p =>
    !p.isMobile &&
    css`
      width: ${PRIMARY_SIDEBAR_WIDTH - 8}px;
      padding-top: ${space(0.5)};
      padding-bottom: ${space(1)};
      gap: ${space(0.5)};

      &:hover,
      &[aria-selected='true'] {
        ${NavLinkIconContainer} {
          &::before {
            opacity: 0.06;
          }
        }
      }

      &:active {
        ${NavLinkIconContainer} {
          &::before {
            opacity: 0.12;
          }
        }
      }

      &[aria-current='page'] {
        color: ${p.theme.purple400};

        ${NavLinkIconContainer} {
          box-shadow: inset 0 0 0 1px ${p.theme.purple100};

          &::before {
            opacity: 0.09;
          }
        }
      }
    `}
`;

const NavLink = withChonk(StyledNavLink, ChonkNavLink);

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

const StyledNavButton = styled(Button, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{isMobile: boolean}>`
  border: none;
  position: relative;
  background: transparent;

  ${baseNavItemStyles}
`;

type NavButtonProps = ButtonProps & {
  isMobile: boolean;
};

// Use a manual theme switch because the types of Button dont seem to play well with withChonk.
const NavButton = styled((p: NavButtonProps) => {
  const theme = useTheme();
  if (theme.isChonk) {
    return (
      <ChonkNavButton
        {...p}
        aria-label={p['aria-label'] ?? ''}
        size={p.isMobile ? 'zero' : undefined}
      />
    );
  }
  return <StyledNavButton {...p} borderless />;
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
  background: ${p => p.theme.purple400};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid ${p => p.theme.background};

  ${p =>
    p.theme.isChonk &&
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
  ${p =>
    p.theme.isChonk &&
    css`
      > div,
      > li {
        width: 100%;
      }
    `}
`;

export const SidebarFooterWrapper = styled('div')<{isMobile: boolean}>`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: auto;
  margin-bottom: ${p => (p.isMobile ? space(1) : 0)};
`;
