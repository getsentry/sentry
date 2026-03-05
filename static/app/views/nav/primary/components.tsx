import {createContext, forwardRef, Fragment, type MouseEventHandler, use} from 'react';
import {css} from '@emotion/react';
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
  size?: ButtonProps['size'];
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

interface SidebarItemDefaultsValue {
  size?: ButtonProps['size'];
}

const SidebarItemDefaultsContext = createContext<SidebarItemDefaultsValue>({});

export function SidebarItemDefaults({
  size,
  children,
}: {
  children: React.ReactNode;
  size?: ButtonProps['size'];
}) {
  return <SidebarItemDefaultsContext value={{size}}>{children}</SidebarItemDefaultsContext>;
}

interface SidebarItemProps extends React.HTMLAttributes<HTMLLIElement> {
  children: React.ReactNode;
  label: string;
  showLabel: boolean;
  disableTooltip?: boolean;
}

export const SidebarItem = forwardRef<HTMLLIElement, SidebarItemProps>(function SidebarItem(
  {children, label, showLabel, disableTooltip, ...props},
  ref
) {
  const {layout} = useNavContext();
  return (
    <IconDefaultsProvider legacySize={layout === NavLayout.MOBILE ? '16px' : '21px'}>
      <SidebarItemFlex
        as="li"
        ref={ref}
        justify="center"
        align="center"
        isMobile={showLabel}
        {...props}
      >
        <Tooltip
          title={label}
          disabled={showLabel || disableTooltip}
          position="right"
          skipWrapper
          delay={600}
        >
          <SidebarItemTooltipAnchor>{children}</SidebarItemTooltipAnchor>
        </Tooltip>
      </SidebarItemFlex>
    </IconDefaultsProvider>
  );
});


export function SidebarMenu({
  items,
  children,
  analyticsKey,
  analyticsParams,
  label,
  onOpen,
  disableTooltip,
  icon,
  size: sizeProp,
  triggerWrap: TriggerWrap = Fragment,
}: SidebarItemDropdownProps) {
  // This component can be rendered without an organization in some cases
  const organization = useOrganization({allowNull: true});
  const {layout} = useNavContext();
  const {size: groupSize} = use(SidebarItemDefaultsContext);
  const size = sizeProp ?? groupSize;

  const showLabel = layout === NavLayout.MOBILE;

  return (
    <DropdownMenu
      position={layout === NavLayout.MOBILE ? 'bottom' : 'right-end'}
      shouldApplyMinWidth={false}
      minMenuWidth={200}
      trigger={({ref: anchorRef, ...triggerProps}) => {
        return (
          <SidebarItem
            label={label}
            showLabel={showLabel}
            disableTooltip={disableTooltip}
            ref={anchorRef as React.Ref<HTMLLIElement>}
          >
            <TriggerWrap>
              <NavButton
                {...triggerProps}
                aria-label={showLabel ? undefined : label}
                onClick={event => {
                  if (organization) {
                    recordPrimaryItemClick(analyticsKey, organization, analyticsParams);
                  }
                  triggerProps.onClick?.(event);
                  onOpen?.(event);
                }}
                isMobile={layout === NavLayout.MOBILE}
                size={size}
                icon={icon}
              >
                {showLabel ? label : null}
                {children}
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
  analyticsParams,
  group,
}: SidebarItemLinkProps) {
  const organization = useOrganization();
  const {layout, activePrimaryNavGroup} = useNavContext();
  const {size} = use(SidebarItemDefaultsContext);
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
      size={size}
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
          <NavLinkIconContainer size={size}>{children}</NavLinkIconContainer>
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
    <SidebarItem label={label} showLabel {...props}>
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
  const {size: groupSize} = use(SidebarItemDefaultsContext);
  const showLabel = layout === NavLayout.MOBILE;
  const {ref: anchorRef, ...restButtonProps} = buttonProps;
  const resolvedButtonProps = {...restButtonProps, size: restButtonProps.size ?? groupSize};

  return (
    <SidebarItem label={label} showLabel={showLabel} className={className} ref={anchorRef as React.Ref<HTMLLIElement>}>
      <NavButton
        {...resolvedButtonProps}
        analyticsParams={analyticsParams}
        isMobile={layout === NavLayout.MOBILE}
        aria-label={showLabel ? undefined : label}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          recordPrimaryItemClick(analyticsKey, organization, analyticsParams);
          resolvedButtonProps.onClick?.(e);
          onClick?.(e);
        }}
        icon={resolvedButtonProps.icon}
      >
        {showLabel ? label : null}
        {children}
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

// Wraps the button inside the li so the tooltip (with skipWrapper) anchors to
// the button width rather than the full-width li element.
const SidebarItemTooltipAnchor = styled('div')``;

const SidebarItemFlex = styled(Flex, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{isMobile: boolean}>`
  ${p =>
    p.isMobile &&
    css`
      > * {
        width: 100%;
      }
    `}
`;

const SeparatorListItem = styled('li')<{hasMargin?: boolean}>`
  list-style: none;
  width: 100%;
  padding: 0 ${p => p.theme.space.lg};
  ${p =>
    p.hasMargin &&
    css`
      margin: ${p => p.theme.space.xs} 0;
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

const NavLinkIconContainer = styled('span')<{size?: ButtonProps['size']}>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => (p.size ? p.theme.space.sm : p.theme.space.md)};
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

const StyledNavButton = styled(Button, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{isMobile: boolean}>`
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

export type NavButtonProps = ButtonProps & {
  isMobile: boolean;
};

export const NavButton = styled((props: NavButtonProps) => {
  return (
    <StyledNavButton
      {...props}
      aria-label={props['aria-label'] ?? ''}
      size={props.isMobile ? 'zero' : props.size}
      priority={props.isMobile ? 'transparent' : props.priority}
    />
  );
})``;

export const SidebarItemUnreadIndicator = styled('span')<{
  isMobile: boolean;
  variant?: 'accent' | 'danger' | 'warning';
}>`
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(calc(50% + 4px), -50%);
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
      top: 2px;
      right: auto;
      left: 11px;
      transform: none;
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

export const SidebarFooterWrapper = styled('div')<{isMobile: boolean}>`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: auto;
  margin-bottom: ${p => (p.isMobile ? p.theme.space.md : 0)};
`;
