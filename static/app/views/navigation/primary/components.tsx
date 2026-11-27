import {Fragment, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope, useFocusRing} from '@react-aria/focus';
import {useHover} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import {IconDefaultsProvider} from '@sentry/icons/useIconDefaults';
import {motion} from 'framer-motion';
import type {LocationDescriptor} from 'history';

import type {ButtonBarProps, ButtonProps} from '@sentry/scraps/button';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {
  Container,
  type ContainerProps,
  Flex,
  type FlexProps,
  Stack,
} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Overlay, type OverlayProps, PositionWrapper} from '@sentry/scraps/overlay';
import {
  OverlayTrigger,
  type OverlayTriggerIconButtonProps,
} from '@sentry/scraps/overlayTrigger';
import {SizeProvider, useSizeContext} from '@sentry/scraps/sizeContext';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useOverlay, type UseOverlayProps} from '@sentry/scraps/useOverlay';

import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE,
  PRIMARY_HEADER_HEIGHT,
  PRIMARY_SIDEBAR_WIDTH,
  SIDEBAR_NAVIGATION_SOURCE,
} from 'sentry/views/navigation/constants';
import {useNavigationTrayAnalyticsParams} from 'sentry/views/navigation/navigationTrayAnalytics';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useSecondaryNavigationToggle} from 'sentry/views/navigation/secondary/useSecondaryNavigationToggle';

interface PrimaryNavigationSidebarProps {
  children: React.ReactNode;
  'data-test-id'?: string;
}

function PrimaryNavigationSidebar({children, ...props}: PrimaryNavigationSidebarProps) {
  const theme = useTheme();
  const {hoverBehavior} = usePrimaryNavigation();

  return (
    <Stack
      as="nav"
      aria-label={t('Primary Navigation')}
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      padding="0"
      borderRight="primary"
      // Positions `PrimaryNavigation.ExpandTab`, which only previews use.
      position={hoverBehavior === 'preview' ? 'relative' : undefined}
      background="primary"
      align="center"
      style={{zIndex: theme.zIndex.sidebarPanel}}
      {...props}
    >
      {children}
    </Stack>
  );
}

interface PrimaryNavigationSidebarHeaderProps extends Omit<FlexProps<'header'>, 'as'> {}

function PrimaryNavigationSidebarHeader(props: PrimaryNavigationSidebarHeaderProps) {
  return (
    <SizeProvider size="sm">
      <Stack
        as="header"
        align="center"
        justify="center"
        borderBottom="primary"
        width="100%"
        height={`${PRIMARY_HEADER_HEIGHT}px`}
        flexShrink={0}
        {...props}
      >
        {props.children}
      </Stack>
    </SizeProvider>
  );
}

interface PrimaryNavigationListProps extends FlexProps<'ul'> {}

function PrimaryNavigationList({children, ...props}: PrimaryNavigationListProps) {
  const {layout} = usePrimaryNavigation();

  return (
    <Stack
      as="ul"
      position="relative"
      margin="0"
      padding="xs"
      width="100%"
      gap="0"
      align={layout === 'mobile' ? 'stretch' : 'center'}
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
  return (
    <Flex as="li" justify="center" align="center" width="100%" {...props}>
      <IconDefaultsProvider size="lg">{children}</IconDefaultsProvider>
    </Flex>
  );
}

interface PrimaryNavigationLinkProps
  extends PrimaryNavigationItemBaseProps, Omit<LinkProps, 'to'> {
  label: string;
  to: string;
  children?: React.ReactNode;
  unreadCount?: number;
}

function PrimaryNavigationLink({unreadCount = 0, ...props}: PrimaryNavigationLinkProps) {
  const organization = useOrganization({allowNull: true});
  // Reload the page when the frontend is stale to ensure users get the latest version
  const {state: appState} = useFrontendVersion();
  const theme = useTheme();
  const getTrayAnalyticsParams = useNavigationTrayAnalyticsParams();
  const label =
    unreadCount > 0
      ? t('%s (%s)', props.label, tn('%s unread item', '%s unread items', unreadCount))
      : props.label;

  const sharedLinkProps = {
    to: props.to,
    reloadDocument: appState === 'stale',
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
    'aria-current': props['aria-current'],
    'aria-label': props['aria-label'] ?? label,
    'aria-keyshortcuts': props['aria-keyshortcuts'],
    'data-active-group': props['data-active-group'],
    onMouseEnter: props.onMouseEnter,
    onMouseLeave: props.onMouseLeave,
    onPointerEnter: props.onPointerEnter,
    onPointerLeave: props.onPointerLeave,
    onKeyDown: props.onKeyDown,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      trackAnalytics('navigation.primary_item_clicked', {
        ...getTrayAnalyticsParams(),
        item: props.analyticsKey,
        organization,
        ...props.analyticsParams,
      });
      props.onClick?.(e);
    },
    [NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE]: true,
  };

  const desktopChildren = (
    <Fragment>
      <Flex
        as="span"
        position="relative"
        align="center"
        justify="center"
        radius="md"
        width={theme.form.sm.height}
        height={theme.form.sm.height}
        data-icon-container
        aria-hidden="true"
      >
        {props.children}
        {unreadCount > 0 && <PrimaryNavigationUnreadIndicator variant="accent" />}
      </Flex>
      <Text size="xs" bold variant="muted" style={{letterSpacing: '-0.05em'}}>
        {props.label}
      </Text>
    </Fragment>
  );

  return (
    <Tooltip title={label} disabled={unreadCount <= 0} position="right" skipWrapper>
      <DesktopNavigationLink {...sharedLinkProps}>
        {desktopChildren}
      </DesktopNavigationLink>
    </Tooltip>
  );
}

interface PrimaryNavigationButtonProps extends PrimaryNavigationItemBaseProps {
  buttonProps: Omit<ButtonProps, 'aria-label' | 'size' | 'icon'> &
    Pick<OverlayTriggerIconButtonProps, 'icon'>;
  label: string;
  indicator?: 'accent' | 'danger' | 'warning';
}

function PrimaryNavigationButton(props: PrimaryNavigationButtonProps) {
  const {layout} = usePrimaryNavigation();
  const organization = useOrganization({allowNull: true});

  return (
    <Tooltip
      title={props.label}
      disabled={layout === 'mobile'}
      position="right"
      skipWrapper
    >
      <NavigationButton
        {...props.buttonProps}
        analyticsParams={props.analyticsParams}
        aria-label={props.label}
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
      />
    </Tooltip>
  );
}

interface PrimaryNavigationUnreadIndicatorProps {
  variant: 'accent' | 'danger' | 'warning';
}

function PrimaryNavigationUnreadIndicator({
  variant,
}: PrimaryNavigationUnreadIndicatorProps) {
  const indicatorPosition: Pick<ContainerProps, 'top' | 'right' | 'left'> = {
    top: '0',
    right: '0',
  };

  return (
    <Container position="absolute" {...indicatorPosition}>
      {p => (
        <StatusIndicator
          {...p}
          animationIterationCount={14}
          variant={variant}
          data-unread-indicator
        />
      )}
    </Container>
  );
}

interface PrimaryNavigationMenuProps extends PrimaryNavigationItemBaseProps {
  icon: OverlayTriggerIconButtonProps['icon'];
  items: MenuItemProps[];
  label: string;
  indicator?: 'accent' | 'danger' | 'warning';
}

function PrimaryNavigationMenu(props: PrimaryNavigationMenuProps) {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});
  const {layout, overlayOffset} = usePrimaryNavigation();

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
      offset={overlayOffset}
      shouldApplyMinWidth={false}
      minMenuWidth={200}
      trigger={triggerProps => {
        return (
          <Tooltip
            title={props.label}
            disabled={layout === 'mobile'}
            position="right"
            skipWrapper
          >
            <NavigationButton
              {...triggerProps}
              aria-label={props.label}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                if (organization) {
                  trackAnalytics('navigation.primary_item_clicked', {
                    item: props.analyticsKey,
                    organization,
                    ...props.analyticsParams,
                  });
                }
                triggerProps.onClick?.(event);
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
            />
          </Tooltip>
        );
      }}
      items={props.items}
    />
  );
}

type NavigationButtonProps = Omit<
  OverlayTriggerIconButtonProps,
  'size' | 'children' | 'showChevron'
> &
  Pick<ButtonProps, 'onClick'>;

function NavigationButton(props: NavigationButtonProps) {
  const {layout} = usePrimaryNavigation();

  return (
    <PrimaryNavigationButtonContainer>
      {p => (
        <ButtonWithOverflowVisible
          {...p}
          {...props}
          {...(layout === 'mobile' ? {variant: 'secondary'} : {variant: props.variant})}
        />
      )}
    </PrimaryNavigationButtonContainer>
  );
}

function PrimaryNavigationButtonContainer(props: React.ComponentProps<typeof Flex>) {
  return <Flex align="center" padding="xs" justify="center" {...props} />;
}

/**
 * @TODO(JonasBadalic) Scraps buttons have been setting overflow hidden onto the inner surface wrapper ever since
 * we inherited that component, and we need to override that to ensure that the indicator is visible as it will
 * otherwise clip the indicator and StatusIndicator animation. We need to unwind this and remove the overflow
 * from buttons from ever being set.
 */
const ButtonWithOverflowVisible = styled(OverlayTrigger.IconButton)<
  Pick<ButtonProps, 'onClick'>
>`
  && > [data-button-label] {
    overflow: initial;
  }
`;

interface PrimaryNavigationExpandTabProps {
  /** Called after the tab expands the sidebar, which also unmounts the tab. */
  onExpand?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Expands a fully hidden secondary sidebar. It sticks out of the rail next to
 * the sidebar header, so it must render inside `PrimaryNavigation.Sidebar`.
 */
function PrimaryNavigationExpandTab({ref, onExpand}: PrimaryNavigationExpandTabProps) {
  const toggleProps = useSecondaryNavigationToggle();
  const {hoverProps, isHovered} = useHover({});
  const {focusProps, isFocusVisible} = useFocusRing();

  return (
    <Fragment>
      <ExpandTabButton
        ref={ref}
        size="sm"
        variant="transparent"
        {...mergeProps(toggleProps, hoverProps, focusProps, {onClick: onExpand})}
      />
      {isHovered || isFocusVisible ? <ExpandTabRailHighlight aria-hidden="true" /> : null}
    </Fragment>
  );
}

// Width of the highlight drawn over the rail edge, including the rail border.
const EXPAND_TAB_HIGHLIGHT_WIDTH = 4;

const ExpandTabButton = styled(Button)`
  && {
    position: absolute;
    top: ${PRIMARY_HEADER_HEIGHT / 2}px;
    /* Start the tab at the inside edge of the highlighted rail border. */
    left: calc(100% - ${EXPAND_TAB_HIGHLIGHT_WIDTH - 1}px);
    z-index: 1;
    translate: 0 -50%;
    box-sizing: border-box;
    width: 40px;
    height: 40px;
    padding-right: ${EXPAND_TAB_HIGHLIGHT_WIDTH - 1}px;
    background-color: ${p => p.theme.tokens.background.primary};
    border: 1px solid ${p => p.theme.tokens.border.primary};
    border-left: 0;
    border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;
  }

  &&:is(:hover, :focus-visible) {
    padding-right: 0;
    background-color: ${p => p.theme.tokens.background.tertiary};
    border-width: ${EXPAND_TAB_HIGHLIGHT_WIDTH}px ${EXPAND_TAB_HIGHLIGHT_WIDTH}px
      ${EXPAND_TAB_HIGHLIGHT_WIDTH}px 0;
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
    box-shadow: none;
  }
`;

const ExpandTabRailHighlight = styled('span')`
  position: absolute;
  top: 0;
  bottom: 0;
  /* Cover the rail border as well. */
  right: -1px;
  border-right: ${EXPAND_TAB_HIGHLIGHT_WIDTH}px solid
    ${p => p.theme.tokens.border.accent.vibrant};
  pointer-events: none;
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

const DesktopNavigationLink = styled((props: LinkProps) => {
  return (
    <Stack
      position="relative"
      width="100%"
      align="center"
      justify="center"
      gap="xs"
      padding="xs xs md xs"
    >
      {p => <Link {...mergeProps(p, props)} />}
    </Stack>
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
  const {layout, overlayOffset = 8} = usePrimaryNavigation();

  return useOverlay({
    offset: overlayOffset,
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
  const {layout} = usePrimaryNavigation();
  const isDesktop = layout !== 'mobile';

  return createPortal(
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper zIndex={theme.zIndex.modal} {...props.overlayProps}>
        <motion.div
          initial={isDesktop ? {opacity: 0, scale: 0.98} : undefined}
          animate={isDesktop ? {opacity: 1, scale: 1} : undefined}
          transition={isDesktop ? theme.motion.framer.enter.moderate : undefined}
        >
          <ScrollableOverlay>{props.children}</ScrollableOverlay>
        </motion.div>
      </PositionWrapper>
    </FocusScope>,
    document.body
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
  IconButton: NavigationButton,
  ButtonContainer: PrimaryNavigationButtonContainer,
  ButtonBar: PrimaryNavigationButtonBar,
  Menu: PrimaryNavigationMenu,
  ButtonOverlay: PrimaryNavigationButtonOverlay,
  Sidebar: PrimaryNavigationSidebar,
  SidebarHeader: PrimaryNavigationSidebarHeader,
  FooterItems: PrimaryNavigationFooterItems,
  ExpandTab: PrimaryNavigationExpandTab,
};
