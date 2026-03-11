import {Fragment, useEffect, useRef, type MouseEventHandler} from 'react';
import {createPortal} from 'react-dom';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import type {LocationDescriptor} from 'history';

import {FeatureBadge} from '@sentry/scraps/badge';
import type {ButtonProps} from '@sentry/scraps/button';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import Hook from 'sentry/components/hook';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useOverlay, {type UseOverlayProps} from 'sentry/utils/useOverlay';
import {
  NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE,
  PRIMARY_SIDEBAR_WIDTH,
  SIDEBAR_NAVIGATION_SOURCE,
} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {useNavigationTour} from 'sentry/views/navigation/navigationTour';
import {PRIMARY_NAVIGATION_GROUP_CONFIG} from 'sentry/views/navigation/primary/config';
import {NavigationLayout} from 'sentry/views/navigation/types';
import type {PrimaryNavigationGroup} from 'sentry/views/navigation/types';
import {useResetActiveNavigationGroup} from 'sentry/views/navigation/useResetActiveNavigationGroup';

function PrimaryNavigation(props: {children: React.ReactNode}) {
  const theme = useTheme();
  const {currentStepId} = useNavigationTour();
  const tourIsActive = currentStepId !== null;
  const navigationContext = useNavigationContext();
  const hoverProps = useResetActiveNavigationGroup();

  return (
    <Flex
      ref={navigationContext.navigationParentRef}
      position={tourIsActive ? undefined : 'sticky'}
      bottom={navigationContext.layout === NavigationLayout.MOBILE ? undefined : 0}
      height={navigationContext.layout === NavigationLayout.MOBILE ? undefined : '100dvh'}
      top={0}
      style={{
        zIndex: tourIsActive ? undefined : theme.zIndex.sidebarPanel,
        userSelect: 'none',
      }}
      {...hoverProps}
    >
      {props.children}
    </Flex>
  );
}

function PrimarySidebar(props: {children: React.ReactNode}) {
  const theme = useTheme();
  const {currentStepId} = useNavigationTour();

  return (
    <Flex
      as="nav"
      aria-label="Primary Navigation"
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      padding="lg 0 md 0"
      borderRight="primary"
      background="primary"
      direction="column"
      style={{zIndex: currentStepId === null ? theme.zIndex.sidebar : undefined}}
    >
      {props.children}
    </Flex>
  );
}

function PrimarySuperuserIndicator() {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});

  return (
    <Container
      top={0}
      left={0}
      position="absolute"
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      style={{
        zIndex: theme.zIndex.initial,
        background: theme.tokens.background.danger.vibrant,
      }}
    >
      <Hook name="component:superuser-warning" organization={organization} />
    </Container>
  );
}

function PrimaryHeader({children}: {children: React.ReactNode}) {
  const organization = useOrganization({allowNull: true});

  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  return (
    <Flex as="header" direction="column" align="center" justify="center">
      {children}
      {showSuperuserWarning && <PrimarySuperuserIndicator />}
    </Flex>
  );
}

// Items in the sidebar
interface PrimaryItemProps extends React.HTMLAttributes<HTMLLIElement> {
  children: React.ReactNode;
  label: string;
  disableTooltip?: boolean;
  ref?: React.Ref<HTMLLIElement>;
}

function PrimaryItem({children, label, disableTooltip, ref, ...props}: PrimaryItemProps) {
  const {layout} = useNavigationContext();
  return (
    <Flex as="li" ref={ref} justify="center" align="center" width="100%" {...props}>
      <IconDefaultsProvider
        legacySize={layout === NavigationLayout.MOBILE ? '16px' : '21px'}
      >
        <Tooltip
          title={label}
          disabled={layout === NavigationLayout.MOBILE || disableTooltip}
          position="right"
          skipWrapper
          delay={600}
        >
          {children}
        </Tooltip>
      </IconDefaultsProvider>
    </Flex>
  );
}

interface PrimaryMenuProps {
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

function PrimaryMenu({
  items,
  children,
  analyticsKey,
  analyticsParams,
  label,
  onOpen,
  disableTooltip,
  icon,
  size,
  triggerWrap: TriggerWrap = Fragment,
}: PrimaryMenuProps) {
  // This component can be rendered without an organization in some cases
  const organization = useOrganization({allowNull: true});
  const {layout} = useNavigationContext();
  const theme = useTheme();

  const showLabel = layout === NavigationLayout.MOBILE;
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
      position={layout === NavigationLayout.MOBILE ? 'bottom' : 'right-end'}
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
              <PrimaryButtonRoot
                {...triggerProps}
                isMobile={layout === NavigationLayout.MOBILE}
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
              </PrimaryButtonRoot>
            </Tooltip>
          </TriggerWrap>
        );
      }}
      items={items}
    />
  );
}

interface PrimaryLinkProps {
  analyticsKey: string;
  group: PrimaryNavigationGroup;
  to: string;
  activeTo?: string;
  analyticsParams?: Record<string, unknown>;
  children?: React.ReactNode;
}

function PrimaryLink({
  children,
  to,
  activeTo = to,
  analyticsKey,
  analyticsParams,
  group,
  ...props
}: PrimaryLinkProps) {
  const label = PRIMARY_NAVIGATION_GROUP_CONFIG[group].label;

  return (
    <PrimaryItem label={label} {...props}>
      <PrimaryNavigationLink
        to={to}
        activeTo={activeTo}
        analyticsKey={analyticsKey}
        analyticsParams={analyticsParams}
        group={group}
      >
        {children}
      </PrimaryNavigationLink>
    </PrimaryItem>
  );
}

function PrimaryNavigationLink({
  children,
  to,
  activeTo = to,
  analyticsKey,
  analyticsParams,
  group,
}: PrimaryLinkProps) {
  const organization = useOrganization();
  const {layout, activePrimaryNavigationGroup} = useNavigationContext();
  const location = useLocation();
  const isActive = isPrimaryLinkActive(
    normalizeUrl(activeTo, location),
    location.pathname
  );
  const label = PRIMARY_NAVIGATION_GROUP_CONFIG[group].label;

  // Reload the page when the frontend is stale to ensure users get the latest version
  const {state: appState} = useFrontendVersion();

  return (
    <PrimaryLinkRoot
      to={to}
      reloadDocument={appState === 'stale'}
      state={{source: SIDEBAR_NAVIGATION_SOURCE}}
      aria-selected={activePrimaryNavigationGroup === group ? true : isActive}
      aria-current={isActive ? 'page' : undefined}
      isMobile={layout === NavigationLayout.MOBILE}
      onClick={() => {
        trackAnalytics('navigation.primary_item_clicked', {
          item: analyticsKey,
          organization,
          ...analyticsParams,
        });
      }}
      {...{
        [NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE]: true,
      }}
    >
      {layout === NavigationLayout.MOBILE ? (
        <Fragment>
          {children}
          {label}
        </Fragment>
      ) : (
        <Fragment>
          <PrimaryLinkIconContainer>{children}</PrimaryLinkIconContainer>
          <PrimaryLinkLabel>{label}</PrimaryLinkLabel>
        </Fragment>
      )}
    </PrimaryLinkRoot>
  );
}

interface PrimaryButtonProps {
  analyticsKey: string;
  label: string;
  analyticsParams?: Record<string, unknown>;
  buttonProps?: Omit<ButtonProps, 'aria-label'>;
  children?: React.ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

function PrimaryButton({
  className,
  analyticsKey,
  analyticsParams,
  children,
  buttonProps = {},
  onClick,
  label,
}: PrimaryButtonProps) {
  const organization = useOrganization();
  const {layout} = useNavigationContext();
  const showLabel = layout === NavigationLayout.MOBILE;

  return (
    <Tooltip title={label} disabled={showLabel} position="right" skipWrapper delay={600}>
      <PrimaryButtonRoot
        {...buttonProps}
        isMobile={layout === NavigationLayout.MOBILE}
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
      </PrimaryButtonRoot>
    </Tooltip>
  );
}

const PrimaryLinkIconContainer = styled('span')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};
`;

const PrimaryLinkLabel = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  letter-spacing: -0.05em;
`;

const PrimaryLinkRoot = styled(Link, {
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
    ${PrimaryLinkIconContainer} {
      outline: none;
      box-shadow: 0 0 0 2px ${p => p.theme.tokens.focus.default};
    }
  }

  &:hover,
  &[aria-selected='true'] {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    ${PrimaryLinkIconContainer} {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }

  &[aria-current='page'] {
    color: ${p => p.theme.tokens.interactive.link.accent.rest};

    &::before {
      opacity: 1;
    }
    ${PrimaryLinkIconContainer} {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    }

    &:hover {
      color: ${p => p.theme.tokens.interactive.link.accent.hover}
        ${PrimaryLinkIconContainer} {
        background-color: ${p =>
          p.theme.tokens.interactive.transparent.accent.selected.background.hover};
      }
    }
  }
`;

const PrimaryButtonRoot = styled(
  ({isMobile: _isMobile, ...props}: ButtonProps & {isMobile: boolean}) => {
    const {layout} = useNavigationContext();

    return (
      <Button
        {...props}
        size={layout === NavigationLayout.MOBILE ? 'zero' : props.size}
        priority={layout === NavigationLayout.MOBILE ? 'transparent' : props.priority}
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

  /* The indicator (PrimaryUnreadIndicator) is passed as children, which causes
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

const PrimaryUnreadIndicator = styled('span')<{
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

function isPrimaryLinkActive(
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

type PrimaryButtonOverlayProps = {
  children: React.ReactNode;
  overlayProps: React.HTMLAttributes<HTMLDivElement>;
};

function usePrimaryButtonOverlay(props: UseOverlayProps = {}) {
  const {layout} = useNavigationContext();

  return useOverlay({
    offset: 8,
    position: layout === NavigationLayout.MOBILE ? 'bottom' : 'right-end',
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
function PrimaryButtonOverlay({children, overlayProps}: PrimaryButtonOverlayProps) {
  const theme = useTheme();
  const {layout} = useNavigationContext();

  return createPortal(
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper zIndex={theme.zIndex.modal} {...overlayProps}>
        <ButtonOverlayScrollable isMobile={layout === NavigationLayout.MOBILE}>
          {children}
        </ButtonOverlayScrollable>
      </PositionWrapper>
    </FocusScope>,
    document.body
  );
}

const ButtonOverlayScrollable = styled(Overlay, {
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

function PrimarySeparator({orientation}: {orientation: 'horizontal' | 'vertical'}) {
  return (
    <Container padding="0 md" as="li" width="100%" style={{listStyleType: 'none'}}>
      <Separator orientation={orientation} />
    </Container>
  );
}

interface PrimaryBodyProps {
  children: React.ReactNode;
  ref?: React.RefObject<HTMLUListElement | null>;
}

function PrimaryItems(props: PrimaryBodyProps) {
  const {layout} = useNavigationContext();
  return (
    <Stack
      as="ul"
      align={layout === NavigationLayout.MOBILE ? 'stretch' : 'center'}
      data-primary-list-container
      width="100%"
      position="relative"
      padding="0"
      paddingTop="md"
      gap="xs"
      {...props}
    />
  );
}

function PrimaryFooter({children}: {children: React.ReactNode}) {
  const {layout} = useNavigationContext();
  const isMobile = layout === NavigationLayout.MOBILE;

  if (!children) {
    return null;
  }

  return (
    <Flex
      align="center"
      justify={isMobile ? 'start' : 'center'}
      width={isMobile ? '100%' : 'auto'}
    >
      {isMobile ? (
        <Stack width="100%">{children}</Stack>
      ) : (
        <PrimaryFooterButtonBar orientation="vertical">{children}</PrimaryFooterButtonBar>
      )}
    </Flex>
  );
}

const PrimaryFeatureBadge = styled(FeatureBadge)`
  position: absolute;
  pointer-events: none;
  top: -2px;
  right: 2px;
  font-size: ${p => p.theme.font.size.xs};
  padding: 0 ${p => p.theme.space.xs};
  height: 16px;
`;

// Force all footer buttons to the same size
const PrimaryFooterButtonBar = styled(ButtonBar)`
  & > button,
  & > span > button {
    width: ${p => p.theme.form.md.height};
    height: ${p => p.theme.form.md.height};
  }
`;

// Layout components
PrimaryNavigation.Header = PrimaryHeader;
PrimaryNavigation.Sidebar = PrimarySidebar;
PrimaryNavigation.Items = PrimaryItems;
PrimaryNavigation.Footer = PrimaryFooter;

PrimaryNavigation.Menu = PrimaryMenu;
PrimaryNavigation.Link = PrimaryLink;
PrimaryNavigation.FeatureBadge = PrimaryFeatureBadge;
PrimaryNavigation.Button = PrimaryButton;
PrimaryNavigation.ButtonOverlay = PrimaryButtonOverlay;
PrimaryNavigation.ButtonUnreadIndicator = PrimaryUnreadIndicator;
PrimaryNavigation.Separator = PrimarySeparator;

PrimaryNavigation.isLinkActive = isPrimaryLinkActive;
PrimaryNavigation.useButtonOverlay = usePrimaryButtonOverlay;

export {PrimaryNavigation};
