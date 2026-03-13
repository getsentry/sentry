import {Fragment, useEffect, useRef, type MouseEventHandler} from 'react';
import {createPortal} from 'react-dom';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import type {LocationDescriptor} from 'history';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOverlay, type UseOverlayProps} from 'sentry/utils/useOverlay';
import {
  NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE,
  SIDEBAR_NAVIGATION_SOURCE,
} from 'sentry/views/navigation/constants';
import {useNavigation} from 'sentry/views/navigation/navigationContext';

interface PrimaryNavigationListProps extends FlexProps<'ul'> {}

function PrimaryNavigationList({children, ...props}: PrimaryNavigationListProps) {
  const {layout} = useNavigation();

  return (
    <Stack
      as="ul"
      position="relative"
      margin="0"
      padding="0"
      width="100%"
      gap="xs"
      align={layout === 'mobile' ? 'stretch' : 'center'}
      paddingTop="md"
      {...props}
    >
      {children}
    </Stack>
  );
}

interface PrimaryNavigationItemBaseProps {
  analyticsKey: string;
  analyticsParams?: Record<string, unknown>;
}

function PrimaryNavigationListItem({children, ...props}: FlexProps<'li'>) {
  const {layout} = useNavigation();
  return (
    <Flex as="li" justify="center" align="center" width="100%" {...props}>
      <IconDefaultsProvider legacySize={layout === 'mobile' ? '16px' : '21px'}>
        {children}
      </IconDefaultsProvider>
    </Flex>
  );
}

interface PrimaryNavigationLinkProps
  extends PrimaryNavigationItemBaseProps, Omit<LinkProps, 'to'> {
  label: string;
  to: string;
  children?: React.ReactNode;
}

function PrimaryNavigationLink(props: PrimaryNavigationLinkProps) {
  const organization = useOrganization();
  const {layout} = useNavigation();

  // Reload the page when the frontend is stale to ensure users get the latest version
  const {state: appState} = useFrontendVersion();

  return (
    <NavigationLink
      to={props.to}
      reloadDocument={appState === 'stale'}
      state={{source: SIDEBAR_NAVIGATION_SOURCE}}
      aria-selected={props['aria-selected']}
      aria-current={props['aria-current']}
      isMobile={layout === 'mobile'}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      onClick={e => {
        trackAnalytics('navigation.primary_item_clicked', {
          item: props.analyticsKey,
          organization,
          ...props.analyticsParams,
        });
        props.onClick?.(e);
      }}
      {...{
        [NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE]: true,
      }}
    >
      {layout === 'mobile' ? (
        <Fragment>
          {props.children}
          {props.label}
        </Fragment>
      ) : (
        <Fragment>
          <NavigationLinkIconContainer>{props.children}</NavigationLinkIconContainer>
          <NavigationLinkLabel>{props.label}</NavigationLinkLabel>
        </Fragment>
      )}
    </NavigationLink>
  );
}

interface PrimaryNavigationButtonProps extends PrimaryNavigationItemBaseProps {
  label: string;
  buttonProps?: Omit<ButtonProps, 'aria-label'>;
  children?: React.ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

function PrimaryNavigationButton({
  analyticsKey,
  analyticsParams,
  children,
  buttonProps = {},
  className,
  onClick,
  label,
}: PrimaryNavigationButtonProps) {
  const organization = useOrganization();
  const {layout} = useNavigation();
  const showLabel = layout === 'mobile';

  return (
    <Tooltip title={label} disabled={showLabel} position="right" skipWrapper delay={600}>
      <NavigationButton
        {...buttonProps}
        isMobile={layout === 'mobile'}
        analyticsParams={analyticsParams}
        className={className}
        aria-label={showLabel ? undefined : label}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          trackAnalytics('navigation.primary_item_clicked', {
            item: analyticsKey,
            organization,
            ...analyticsParams,
          });
          buttonProps.onClick?.(e);
          onClick?.(e);
        }}
        icon={buttonProps.icon}
      >
        {showLabel ? label : null}
        {children}
      </NavigationButton>
    </Tooltip>
  );
}

interface PrimaryNavigationMenuProps extends PrimaryNavigationItemBaseProps {
  items: MenuItemProps[];
  label: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  onOpen?: MouseEventHandler<HTMLButtonElement>;
  size?: ButtonProps['size'];
  triggerWrap?: React.ComponentType<{children: React.ReactNode}>;
}

function PrimaryNavigationMenu({
  items,
  children,
  analyticsKey,
  analyticsParams,
  label,
  onOpen,
  icon,
  size,
  triggerWrap: TriggerWrap = Fragment,
}: PrimaryNavigationMenuProps) {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});
  const {layout} = useNavigation();

  const showLabel = layout === 'mobile';
  const portalContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  return (
    <DropdownMenu
      usePortal
      portalContainerRef={portalContainerRef}
      zIndex={theme.zIndex.modal}
      renderWrapAs={PassthroughWrapper}
      position={layout === 'mobile' ? 'bottom' : 'right-end'}
      shouldApplyMinWidth={false}
      minMenuWidth={200}
      trigger={triggerProps => {
        return (
          <TriggerWrap>
            <Tooltip
              title={label}
              disabled={showLabel}
              position="right"
              skipWrapper
              delay={600}
            >
              <NavigationButton
                {...triggerProps}
                isMobile={layout === 'mobile'}
                aria-label={showLabel ? undefined : label}
                size={size}
                onClick={event => {
                  if (organization) {
                    trackAnalytics('navigation.primary_item_clicked', {
                      item: analyticsKey,
                      organization,
                      ...analyticsParams,
                    });
                  }
                  triggerProps.onClick?.(event);
                  onOpen?.(event);
                }}
                icon={icon}
              >
                {showLabel ? label : null}
                {children}
              </NavigationButton>
            </Tooltip>
          </TriggerWrap>
        );
      }}
      items={items}
    />
  );
}

function PrimaryNavigationSeparator({className}: {className?: string}) {
  return (
    <SeparatorListItem aria-hidden className={className}>
      <Separator />
    </SeparatorListItem>
  );
}

const SeparatorListItem = styled('li')`
  list-style: none;
  width: 100%;
  padding: 0 ${p => p.theme.space.lg};
`;

const Separator = styled('hr')`
  outline: 0;
  border: 0;
  height: 1px;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background: ${p => p.theme.tokens.border.secondary};
  margin: 0;
`;

const NavigationLinkIconContainer = styled('span')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};
`;

const NavigationLinkLabel = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  letter-spacing: -0.05em;
`;

const NavigationLink = styled(Link, {
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
    ${NavigationLinkIconContainer} {
      outline: none;
      box-shadow: 0 0 0 2px ${p => p.theme.tokens.focus.default};
    }
  }

  &:hover,
  &[aria-selected='true'] {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    ${NavigationLinkIconContainer} {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }

  &[aria-current='page'] {
    color: ${p => p.theme.tokens.interactive.link.accent.rest};

    &::before {
      opacity: 1;
    }
    ${NavigationLinkIconContainer} {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    }

    &:hover {
      color: ${p => p.theme.tokens.interactive.link.accent.hover}
        ${NavigationLinkIconContainer} {
        background-color: ${p =>
          p.theme.tokens.interactive.transparent.accent.selected.background.hover};
      }
    }
  }
`;

const NavigationButton = styled(
  ({isMobile: _isMobile, ...props}: ButtonProps & {isMobile: boolean}) => {
    const {layout} = useNavigation();

    return (
      <Button
        {...props}
        size={layout === 'mobile' ? 'zero' : props.size}
        priority={layout === 'mobile' ? 'transparent' : props.priority}
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

  /* Navigation buttons are icon-only; allow icon content to overflow the inner span */
  > span:last-child {
    overflow: visible;
  }

  /* The indicator (PrimaryNavigationUnreadIndicator) is passed as children, which causes
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

const PrimaryNavigationUnreadIndicator = styled('span')<{
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

type PrimaryNavigationButtonOverlayProps = {
  children: React.ReactNode;
  overlayProps: React.HTMLAttributes<HTMLDivElement>;
};

export function usePrimaryNavigationButtonOverlay(props: UseOverlayProps = {}) {
  const {layout} = useNavigation();

  return useOverlay({
    offset: 8,
    position: layout === 'mobile' ? 'bottom' : 'right-end',
    isDismissable: true,
    shouldApplyMinWidth: false,
    ...props,
  });
}

/**
 * Overlay to be used for primary navigation buttons in footer, such as
 * "what's new" and "onboarding". This will appear as a normal overlay
 * on desktop and a modified overlay in mobile to match the design of
 * the mobile topbar.
 */
function PrimaryNavigationButtonOverlay({
  children,
  overlayProps,
}: PrimaryNavigationButtonOverlayProps) {
  const theme = useTheme();
  const {layout} = useNavigation();

  return createPortal(
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper zIndex={theme.zIndex.modal} {...overlayProps}>
        <ScrollableOverlay isMobile={layout === 'mobile'}>{children}</ScrollableOverlay>
      </PositionWrapper>
    </FocusScope>,
    document.body
  );
}

const ScrollableOverlay = styled(Overlay, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{
  isMobile: boolean;
}>`
  overscroll-behavior: none;
  min-height: 150px;
  max-height: ${p => (p.isMobile ? '80vh' : '60vh')};
  overflow-y: auto;
  width: ${p => (p.isMobile ? `calc(100vw - ${p.theme.space['3xl']})` : '400px')};
`;

export function isPrimaryNavigationLinkActive(
  to: LocationDescriptor | string,
  pathname: string,
  options: {end?: boolean} = {end: false}
): boolean {
  const toPathname = normalizeUrl(typeof to === 'string' ? to : (to.pathname ?? '/'));

  if (options.end) {
    return pathname === toPathname;
  }

  return pathname.startsWith(toPathname);
}

// Stable module-level component to avoid remounts when used as `renderWrapAs`
function PassthroughWrapper({children}: {children: React.ReactNode}) {
  return children;
}

export const PrimaryNavigation = {
  List: PrimaryNavigationList,
  ListItem: PrimaryNavigationListItem,
  Link: PrimaryNavigationLink,
  Button: PrimaryNavigationButton,
  Menu: PrimaryNavigationMenu,
  Separator: PrimaryNavigationSeparator,
  UnreadIndicator: PrimaryNavigationUnreadIndicator,
  ButtonOverlay: PrimaryNavigationButtonOverlay,
};
