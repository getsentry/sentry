import {Fragment, type MouseEventHandler} from 'react';
import {css, type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {linkStyles} from 'sentry/components/links/styles';
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
import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';
import {isLinkActive} from 'sentry/views/nav/utils';

interface SidebarItemLinkProps {
  analyticsKey: string;
  label: string;
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
  forceLabel?: boolean;
  onOpen?: MouseEventHandler<HTMLButtonElement>;
}

interface SidebarButtonProps {
  analyticsKey: string;
  children: React.ReactNode;
  label: string;
  buttonProps?: React.HTMLAttributes<HTMLButtonElement>;
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
}

export function SidebarItem({children, label, showLabel, ...props}: SidebarItemProps) {
  const {layout} = useNavContext();
  return (
    <IconDefaultsProvider legacySize={layout === NavLayout.MOBILE ? '16px' : '21px'}>
      <Tooltip title={label} disabled={showLabel} position="right" skipWrapper delay={0}>
        <SidebarListItem {...props}>{children}</SidebarListItem>
      </Tooltip>
    </IconDefaultsProvider>
  );
}

export function SidebarMenu({
  items,
  children,
  analyticsKey,
  label,
  forceLabel,
  onOpen,
}: SidebarItemDropdownProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {layout} = useNavContext();

  const showLabel = forceLabel || layout === NavLayout.MOBILE;

  return (
    <DropdownMenu
      position={layout === NavLayout.MOBILE ? 'bottom' : 'right-end'}
      shouldApplyMinWidth={false}
      minMenuWidth={200}
      trigger={(props, isOpen) => {
        return (
          <SidebarItem label={label} showLabel={showLabel}>
            <NavButton
              {...props}
              aria-label={showLabel ? undefined : label}
              onClick={event => {
                recordPrimaryItemClick(analyticsKey, organization);
                props.onClick?.(event);
                onOpen?.(event);
              }}
              isMobile={layout === NavLayout.MOBILE}
            >
              {theme.isChonk ? null : (
                <InteractionStateLayer hasSelectedBackground={isOpen} />
              )}
              {children}
              {showLabel ? label : null}
            </NavButton>
          </SidebarItem>
        );
      }}
      items={items}
    />
  );
}

export function SidebarLink({
  children,
  to,
  activeTo = to,
  analyticsKey,
  label,
}: SidebarItemLinkProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const isActive = isLinkActive(normalizeUrl(activeTo, location), location.pathname);
  const {layout} = useNavContext();

  return (
    <SidebarItem label={label} showLabel>
      <NavLink
        to={to}
        state={{source: SIDEBAR_NAVIGATION_SOURCE}}
        onClick={() => recordPrimaryItemClick(analyticsKey, organization)}
        aria-selected={isActive}
        aria-current={isActive ? 'page' : undefined}
        isMobile={layout === NavLayout.MOBILE}
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
      >
        {theme.isChonk ? null : <InteractionStateLayer />}
        {children}
        {showLabel ? label : null}
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
  font-size: ${p.theme.fontSizeMedium};
  font-weight: ${p.theme.fontWeightNormal};
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
  border-radius: ${p => p.theme.radius.lg};
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
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: ${p => p.theme.fontWeightBold};
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
  color: ${p => p.theme.textColor};
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
    border-radius: ${p => p.theme.radius.micro};
    background-color: ${p => p.theme.colors.blue400};
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

  &:hover {
    color: ${p => p.theme.textColor};
    ${NavLinkIconContainer} {
      background-color: ${p => p.theme.colors.gray100};
    }
  }

  &[aria-selected='true'] {
    color: ${p => p.theme.purple400};

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

      &:hover {
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

      &[aria-selected='true'] {
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
  padding: ${p => (p.isMobile ? `${space(1)} ${space(3)}` : undefined)};

  svg {
    margin-right: ${p => (p.isMobile ? space(1) : undefined)};
  }

  /* Disable interactionstatelayer hover */
  [data-isl] {
    display: none;
  }
`;

const StyledNavButton = styled('button', {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{isMobile: boolean}>`
  border: none;
  position: relative;
  background: transparent;

  ${linkStyles}
  ${baseNavItemStyles}
`;

interface NavButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  isMobile: boolean;
}

// Use a manual theme switch because the types of Button dont seem to play well with withChonk.
export const NavButton = styled((p: NavButtonProps) => {
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
  return <StyledNavButton {...p} />;
})``;

export const SidebarItemUnreadIndicator = styled('span')<{isMobile: boolean}>`
  position: absolute;
  top: ${p => (p.isMobile ? `8px` : `calc(50% - 12px)`)};
  left: ${p => (p.isMobile ? '32px' : `calc(50% + 14px)`)};
  transform: translate(-50%, -50%);
  display: block;
  text-align: center;
  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  background: ${p => p.theme.purple400};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid ${p => p.theme.background};
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
