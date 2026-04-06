import {Fragment, useEffect, useRef, type MouseEventHandler} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {mergeProps} from '@react-aria/utils';
import type {LocationDescriptor} from 'history';
import type {DistributedOmit} from 'type-fest';

import {FeatureBadge, type FeatureBadgeProps} from '@sentry/scraps/badge';
import type {ButtonBarProps, ButtonProps} from '@sentry/scraps/button';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {
  Container,
  Flex,
  Stack,
  type FlexProps,
  type ContainerProps,
} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {SizeProvider, useSizeContext} from '@sentry/scraps/sizeContext';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import Hook from 'sentry/components/hook';
import {Overlay, PositionWrapper, type OverlayProps} from 'sentry/components/overlay';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {HookStore} from 'sentry/stores/hookStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOverlay, type UseOverlayProps} from 'sentry/utils/useOverlay';
import {
  NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE,
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
  PRIMARY_SIDEBAR_WIDTH,
  SIDEBAR_NAVIGATION_SOURCE,
} from 'sentry/views/navigation/constants';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

interface PrimaryNavigationSidebarProps {
  children: React.ReactNode;
  'data-test-id'?: string;
}

function PrimaryNavigationSidebar({children, ...props}: PrimaryNavigationSidebarProps) {
  const theme = useTheme();
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Flex
      as="nav"
      aria-label={t('Primary Navigation')}
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      padding={hasPageFrame ? '0' : 'lg 0 md 0'}
      borderRight="primary"
      background="primary"
      direction="column"
      align="center"
      style={{zIndex: theme.zIndex.sidebarPanel}}
      {...props}
    >
      {children}
    </Flex>
  );
}

interface PrimaryNavigationSidebarHeaderProps extends Omit<FlexProps<'header'>, 'as'> {}

function PrimaryNavigationSidebarHeader(props: PrimaryNavigationSidebarHeaderProps) {
  const theme = useTheme();
  const {layout} = usePrimaryNavigation();
  const organization = useOrganization({allowNull: true});
  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  const hasPageFrame = useHasPageFrameFeature();

  return (
    <SizeProvider size={hasPageFrame ? 'sm' : 'md'}>
      <Flex
        as="header"
        direction="column"
        align="center"
        justify="center"
        borderBottom={hasPageFrame ? 'primary' : undefined}
        width={hasPageFrame ? '100%' : undefined}
        minHeight={
          hasPageFrame
            ? layout === 'mobile'
              ? `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`
              : `${PRIMARY_HEADER_HEIGHT}px`
            : undefined
        }
        height={
          hasPageFrame
            ? layout === 'mobile'
              ? `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`
              : `${PRIMARY_HEADER_HEIGHT}px`
            : undefined
        }
        {...props}
      >
        {props.children}
        {showSuperuserWarning && (
          <Container
            position="absolute"
            top={0}
            left={0}
            width={`${PRIMARY_SIDEBAR_WIDTH}px`}
            style={{
              zIndex: theme.zIndex.initial,
              background: theme.tokens.background.danger.vibrant,
            }}
          >
            <Hook name="component:superuser-warning" organization={organization} />
          </Container>
        )}
      </Flex>
    </SizeProvider>
  );
}

interface PrimaryNavigationListProps extends FlexProps<'ul'> {}

function PrimaryNavigationList({children, ...props}: PrimaryNavigationListProps) {
  const {layout} = usePrimaryNavigation();
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Stack
      as="ul"
      position="relative"
      margin="0"
      padding={hasPageFrame ? 'xs' : '0'}
      width="100%"
      gap={hasPageFrame ? '0' : 'xs'}
      align={layout === 'mobile' ? 'stretch' : 'center'}
      paddingTop={hasPageFrame ? undefined : 'md'}
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
  const {layout} = usePrimaryNavigation();
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
  const organization = useOrganization({allowNull: true});
  const {layout, features} = usePrimaryNavigation();
  const hasPageFrame = useHasPageFrameFeature();
  const isMobilePageFrame = hasPageFrame && layout === 'mobile';
  // Reload the page when the frontend is stale to ensure users get the latest version
  const {state: appState} = useFrontendVersion();
  const theme = useTheme();

  const sharedLinkProps = {
    to: props.to,
    reloadDocument: appState === 'stale',
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
    'aria-current': props['aria-current'],
    'data-active-group': props['data-active-group'],
    onMouseEnter: props.onMouseEnter,
    onMouseLeave: props.onMouseLeave,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      // On touch devices with page frame, prevent navigation and let setActiveGroup handle the active state
      if (isMobilePageFrame && !features.hover) {
        e.preventDefault();
      }
      trackAnalytics('navigation.primary_item_clicked', {
        item: props.analyticsKey,
        organization,
        ...props.analyticsParams,
      });
      props.onClick?.(e);
    },
    [NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE]: true,
  };

  if (layout === 'mobile' && !isMobilePageFrame) {
    return (
      <MobileNavigationLink {...sharedLinkProps}>
        {props.children}
        {props.label}
      </MobileNavigationLink>
    );
  }

  const desktopChildren = (
    <Fragment>
      <Flex
        as="span"
        align="center"
        justify="center"
        radius="md"
        padding={hasPageFrame ? 'xs' : 'sm'}
        width={hasPageFrame ? theme.form.sm.height : undefined}
        height={hasPageFrame ? theme.form.sm.height : undefined}
        data-icon-container
        aria-hidden="true"
      >
        {props.children}
      </Flex>
      <Text size="xs" bold variant="muted" style={{letterSpacing: '-0.05em'}}>
        {props.label}
      </Text>
    </Fragment>
  );

  if (hasPageFrame) {
    return (
      <DesktopPageFrameNavigationLink {...sharedLinkProps}>
        {desktopChildren}
      </DesktopPageFrameNavigationLink>
    );
  }

  return (
    <DesktopNavigationLink {...sharedLinkProps}>{desktopChildren}</DesktopNavigationLink>
  );
}

interface PrimaryNavigationButtonProps extends PrimaryNavigationItemBaseProps {
  label: string;
  buttonProps?: Omit<ButtonProps, 'aria-label' | 'size'>;
  children?: React.ReactNode;
  indicator?: 'accent' | 'danger' | 'warning';
}

function PrimaryNavigationButton(props: PrimaryNavigationButtonProps) {
  const {layout} = usePrimaryNavigation();
  const organization = useOrganization({allowNull: true});
  const hasPageFrame = useHasPageFrameFeature();
  const isMobilePageFrame = hasPageFrame && layout === 'mobile';

  return (
    <Tooltip
      title={props.label}
      disabled={layout === 'mobile'}
      position="right"
      skipWrapper
      delay={600}
    >
      <NavigationButton
        {...props.buttonProps}
        analyticsParams={props.analyticsParams}
        aria-label={layout === 'mobile' ? undefined : props.label}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          trackAnalytics('navigation.primary_item_clicked', {
            item: props.analyticsKey,
            organization,
            ...props.analyticsParams,
          });
          props.buttonProps?.onClick?.(e);
        }}
        icon={
          props.indicator ? (
            <Fragment>
              {props.buttonProps?.icon}
              <PrimaryNavigationUnreadIndicator
                data-unread-indicator
                variant={props.indicator}
              />
            </Fragment>
          ) : (
            props.buttonProps?.icon
          )
        }
      >
        {layout === 'mobile' && !isMobilePageFrame ? props.label : null}
        {props.children}
      </NavigationButton>
    </Tooltip>
  );
}

interface PrimaryNavigationUnreadIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: 'accent' | 'danger' | 'warning';
}

function PrimaryNavigationUnreadIndicator({
  variant,
  ...props
}: PrimaryNavigationUnreadIndicatorProps) {
  const theme = useTheme();
  const {layout} = usePrimaryNavigation();
  const hasPageFrame = useHasPageFrameFeature();
  const indicatorPosition: Pick<
    ContainerProps<'div'>,
    'top' | 'right' | 'left'
  > = hasPageFrame
    ? layout === 'mobile'
      ? {top: '0', right: '0'}
      : {top: '0', right: '0'}
    : layout === 'mobile'
      ? {left: '11px', top: `-${theme.space['2xs']}`}
      : {top: '0', right: '0'};

  return (
    <Container position="absolute" {...indicatorPosition}>
      {p => (
        <StatusIndicator
          {...mergeProps(p, props)}
          variant={variant}
          data-unread-indicator
        />
      )}
    </Container>
  );
}

interface PrimaryNavigationMenuProps extends PrimaryNavigationItemBaseProps {
  items: MenuItemProps[];
  label: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  indicator?: 'accent' | 'danger' | 'warning';
  onOpen?: MouseEventHandler<HTMLButtonElement>;
  triggerWrap?: React.ComponentType<{children: React.ReactNode}>;
}

function PrimaryNavigationMenu(props: PrimaryNavigationMenuProps) {
  const TriggerWrap = props.triggerWrap ?? Fragment;
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});
  const {layout} = usePrimaryNavigation();
  const hasPageFrame = useHasPageFrameFeature();
  const isMobilePageFrame = hasPageFrame && layout === 'mobile';

  const portalContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  const sizeContext = useSizeContext();

  return (
    <DropdownMenu
      usePortal
      size={sizeContext}
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
              title={props.label}
              disabled={layout === 'mobile'}
              position="right"
              skipWrapper
              delay={600}
            >
              <NavigationButton
                {...triggerProps}
                aria-label={layout === 'mobile' ? undefined : props.label}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  if (organization) {
                    trackAnalytics('navigation.primary_item_clicked', {
                      item: props.analyticsKey,
                      organization,
                      ...props.analyticsParams,
                    });
                  }
                  triggerProps.onClick?.(event);
                  props.onOpen?.(event);
                }}
                icon={
                  props.indicator ? (
                    <Fragment>
                      {props.icon}
                      <PrimaryNavigationUnreadIndicator variant={props.indicator} />
                    </Fragment>
                  ) : (
                    props.icon
                  )
                }
              >
                {layout === 'mobile' && !isMobilePageFrame ? (
                  <Fragment>
                    {props.label}
                    {props.children}
                  </Fragment>
                ) : layout === 'mobile' ? null : (
                  props.children
                )}
              </NavigationButton>
            </Tooltip>
          </TriggerWrap>
        );
      }}
      items={props.items}
    />
  );
}

function NavigationButton(props: DistributedOmit<ButtonProps, 'size'>) {
  const {layout} = usePrimaryNavigation();
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Flex
      align="center"
      height={layout === 'mobile' && !hasPageFrame ? 'auto' : undefined}
      width={layout === 'mobile' && !hasPageFrame ? '100%' : undefined}
      padding={layout === 'mobile' && !hasPageFrame ? 'md lg' : 'xs'}
      justify={layout === 'mobile' && !hasPageFrame ? 'start' : 'center'}
    >
      {p => (
        <ButtonWithOverflowVisible
          {...p}
          {...props}
          {...(layout === 'mobile'
            ? hasPageFrame
              ? {priority: 'default'}
              : {size: 'zero' as const, priority: 'transparent'}
            : {priority: props.priority})}
        />
      )}
    </Flex>
  );
}

/**
 * @TODO(JonasBadalic) Scraps buttons have been setting overflow hidden onto the inner surface wrapper ever since
 * we inherited that component, and we need to override that to ensure that the indicator is visible as it will
 * otherwise clip the indicator and StatusIndicator animation. We need to unwind this and remove the overflow
 * from buttons from ever being set.
 */
const ButtonWithOverflowVisible = styled(Button)`
  > span:last-child {
    overflow: initial;
  }
`;

function PrimaryNavigationButtonBar(props: ButtonBarProps) {
  return <ButtonBar {...props} width="100%" />;
}

interface PrimaryNavigationFooterItemsProps {
  children: NonNullable<React.ReactNode>;
}

function PrimaryNavigationFooterItems(props: PrimaryNavigationFooterItemsProps) {
  const {layout} = usePrimaryNavigation();

  return (
    <Flex
      display="flex"
      align="center"
      justify={layout === 'mobile' ? 'start' : 'center'}
      width={layout === 'mobile' ? '100%' : 'auto'}
    >
      {layout === 'mobile' ? (
        <Stack width="100%">{props.children}</Stack>
      ) : (
        <Stack width="100%" marginTop="auto">
          <PrimaryNavigation.ButtonBar orientation="vertical">
            {props.children}
          </PrimaryNavigation.ButtonBar>
        </Stack>
      )}
    </Flex>
  );
}

function PrimaryNavigationSeparator() {
  return <Stack.Separator border="muted" style={{width: '100%'}} />;
}

const MobileNavigationLink = styled((props: LinkProps) => (
  <Flex
    position="relative"
    width="100%"
    align="center"
    direction="row"
    justify="start"
    gap="md"
    padding="md lg"
  >
    {p => <Link {...mergeProps(p, props)} />}
  </Flex>
))`
  color: ${p => p.theme.tokens.content.primary};
  font-weight: ${p => p.theme.font.weight.sans.medium};
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
    top: 50%;
    transform: translateY(-50%);
    left: 0px;
    width: 4px;
    height: 20px;
    border-radius: ${p => p.theme.radius['2xs']};
    background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
  }

  &:focus-visible {
    [data-icon-container] {
      outline: none;
      box-shadow: 0 0 0 2px ${p => p.theme.tokens.focus.default};
    }
  }

  &:hover,
  &[data-active-group='true'] {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};

    [data-icon-container] {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }

  &[aria-current='location'] {
    color: ${p => p.theme.tokens.interactive.link.accent.rest};

    &::before {
      opacity: 1;
    }

    [data-icon-container] {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    }

    &:hover {
      color: ${p => p.theme.tokens.interactive.link.accent.hover};

      [data-icon-container] {
        background-color: ${p =>
          p.theme.tokens.interactive.transparent.accent.selected.background.hover};
      }
    }
  }
`;

const DesktopNavigationLink = styled((props: LinkProps) => (
  <Flex
    position="relative"
    width="100%"
    align="center"
    direction="column"
    justify="center"
    gap="xs"
    padding="sm lg"
  >
    {p => <Link {...mergeProps(p, props)} />}
  </Flex>
))`
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

  /* Active state indicator bar */
  &::before {
    content: '';
    position: absolute;
    /* We align the active state indicator to the top of the icon container, not to the center of the button */
    top: 12px;
    left: 0px;
    width: 4px;
    height: 20px;
    border-radius: ${p => p.theme.radius['2xs']};
    background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
  }

  &:focus-visible {
    [data-icon-container] {
      outline: none;
      box-shadow: 0 0 0 2px ${p => p.theme.tokens.focus.default};
    }
  }

  &:hover,
  &[data-active-group='true'] {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};

    [data-icon-container] {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }

  &[aria-current='location'] {
    color: ${p => p.theme.tokens.interactive.link.accent.rest};

    &::before {
      opacity: 1;
    }

    [data-icon-container] {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    }

    &:hover {
      color: ${p => p.theme.tokens.interactive.link.accent.hover};

      [data-icon-container] {
        background-color: ${p =>
          p.theme.tokens.interactive.transparent.accent.selected.background.hover};
      }
    }
  }
`;

const DesktopPageFrameNavigationLink = styled((props: LinkProps) => {
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Flex
      position="relative"
      width="100%"
      align="center"
      direction="column"
      justify="center"
      gap="xs"
      padding={hasPageFrame ? 'xs xs md xs' : 'xs'}
    >
      {p => <Link {...mergeProps(p, props)} />}
    </Flex>
  );
})`
  outline: none;
  box-shadow: none;
  transition: none;
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};

  [data-icon-container] {
    border: 1px solid transparent;
  }

  &:hover,
  &[data-active-group='true'] {
    [data-icon-container] {
      border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }

    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
  }

  &:active {
    color: ${p => p.theme.tokens.content.primary};

    [data-icon-container] {
      border: 1px solid ${p => p.theme.tokens.interactive.transparent.accent.border};
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.background.active};
    }
  }

  &:focus-visible {
    box-shadow: none;
    outline: none;
    color: ${p => p.theme.tokens.interactive.link.neutral.rest};

    [data-icon-container] {
      ${p => p.theme.focusRing()}
    }
  }

  &[aria-current='location'] {
    [data-icon-container] {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
      border: 1px solid ${p => p.theme.tokens.border.transparent.accent.muted};
    }

    color: ${p => p.theme.tokens.content.primary};
  }
`;

type PrimaryNavigationButtonOverlayProps = {
  children: React.ReactNode;
  overlayProps: React.HTMLAttributes<HTMLDivElement>;
};

export function usePrimaryNavigationButtonOverlay(props: UseOverlayProps = {}) {
  const {layout} = usePrimaryNavigation();

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
function PrimaryNavigationButtonOverlay(props: PrimaryNavigationButtonOverlayProps) {
  const theme = useTheme();

  return createPortal(
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper zIndex={theme.zIndex.modal} {...props.overlayProps}>
        <ScrollableOverlay>{props.children}</ScrollableOverlay>
      </PositionWrapper>
    </FocusScope>,
    document.body
  );
}

function PrimaryNavigationButtonFeatureBadge(props: FeatureBadgeProps) {
  const hasPageFrame = useHasPageFrameFeature();

  if (hasPageFrame) {
    return null;
  }

  return (
    <Container
      right="6px"
      top="0px"
      position="absolute"
      padding="0 xs"
      height="16px"
      pointerEvents="none"
    >
      {p => (
        <FeatureBadge
          {...mergeProps(p, props)}
          type="alpha"
          aria-hidden="true"
          style={{fontSize: '11px'}}
        />
      )}
    </Container>
  );
}

function ScrollableOverlay(props: OverlayProps) {
  const theme = useTheme();
  const {layout} = usePrimaryNavigation();
  return (
    <Container
      overflowY="auto"
      overscrollBehavior="none"
      maxHeight={layout === 'mobile' ? '80vh' : '60vh'}
      width={layout === 'mobile' ? `calc(100vw - ${theme.space['3xl']})` : '400px'}
      padding="lg"
    >
      {p => <Overlay {...mergeProps(p, props)} />}
    </Container>
  );
}

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

interface PassthroughWrapperProps {
  children: React.ReactNode;
}

// Stable module-level component to avoid remounts when used as `renderWrapAs`
function PassthroughWrapper(props: PassthroughWrapperProps) {
  return props.children;
}

export const PrimaryNavigation = {
  List: PrimaryNavigationList,
  ListItem: PrimaryNavigationListItem,
  Link: PrimaryNavigationLink,
  Button: PrimaryNavigationButton,
  ButtonFeatureBadge: PrimaryNavigationButtonFeatureBadge,
  ButtonBar: PrimaryNavigationButtonBar,
  Menu: PrimaryNavigationMenu,
  Separator: PrimaryNavigationSeparator,
  ButtonOverlay: PrimaryNavigationButtonOverlay,
  Sidebar: PrimaryNavigationSidebar,
  SidebarHeader: PrimaryNavigationSidebarHeader,
  FooterItems: PrimaryNavigationFooterItems,
};
