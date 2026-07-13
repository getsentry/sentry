import {Fragment, type MouseEventHandler, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {mergeProps} from '@react-aria/utils';
import {motion} from 'framer-motion';
import type {LocationDescriptor} from 'history';
import type {DistributedOmit} from 'type-fest';

import type {ButtonBarProps, ButtonProps} from '@sentry/scraps/button';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {
  Container,
  type ContainerProps,
  Flex,
  type FlexProps,
  Stack,
} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {SizeProvider, useSizeContext} from '@sentry/scraps/sizeContext';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import {Overlay, type OverlayProps, PositionWrapper} from 'sentry/components/overlay';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOverlay, type UseOverlayProps} from 'sentry/utils/useOverlay';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE,
  PRIMARY_HEADER_HEIGHT,
  PRIMARY_SIDEBAR_WIDTH,
  SIDEBAR_NAVIGATION_SOURCE,
} from 'sentry/views/navigation/constants';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';

interface PrimaryNavigationSidebarProps {
  children: React.ReactNode;
  'data-test-id'?: string;
}

function PrimaryNavigationSidebar({children, ...props}: PrimaryNavigationSidebarProps) {
  const theme = useTheme();

  return (
    <Stack
      as="nav"
      aria-label={t('Primary Navigation')}
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      padding="0"
      borderRight="primary"
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
  const {layout} = usePrimaryNavigation();

  return (
    <SizeProvider size="sm">
      <Stack
        as="header"
        align="center"
        justify="center"
        borderBottom="primary"
        width="100%"
        minHeight={
          layout === 'mobile'
            ? `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`
            : `${PRIMARY_HEADER_HEIGHT}px`
        }
        height={
          layout === 'mobile'
            ? `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`
            : `${PRIMARY_HEADER_HEIGHT}px`
        }
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
  const isMobilePageFrame = layout === 'mobile';
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

  const desktopChildren = (
    <Fragment>
      <Flex
        as="span"
        align="center"
        justify="center"
        radius="md"
        padding="xs"
        width={theme.form.sm.height}
        height={theme.form.sm.height}
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

  return (
    <DesktopPageFrameNavigationLink {...sharedLinkProps}>
      {desktopChildren}
    </DesktopPageFrameNavigationLink>
  );
}

interface PrimaryNavigationButtonProps extends PrimaryNavigationItemBaseProps {
  label: React.ReactNode;
  buttonProps?: Omit<ButtonProps, 'aria-label' | 'size'>;
  children?: React.ReactNode;
  indicator?: 'accent' | 'danger' | 'warning';
}

function PrimaryNavigationButton(props: PrimaryNavigationButtonProps) {
  const {layout} = usePrimaryNavigation();
  const organization = useOrganization({allowNull: true});

  const ariaLabel =
    layout === 'mobile'
      ? undefined
      : typeof props.label === 'string'
        ? props.label
        : undefined;

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
        aria-label={ariaLabel}
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
  const indicatorPosition: Pick<ContainerProps, 'top' | 'right' | 'left'> = {
    top: '0',
    right: '0',
  };

  return (
    <Container position="absolute" {...indicatorPosition}>
      {p => (
        <StatusIndicator
          {...mergeProps(p, props)}
          animationIterationCount={14}
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
                {layout === 'mobile' ? null : props.children}
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

  return (
    <Flex align="center" padding="xs" justify="center">
      {p => (
        <ButtonWithOverflowVisible
          {...p}
          {...props}
          {...(layout === 'mobile' ? {variant: 'secondary'} : {variant: props.variant})}
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

const DesktopPageFrameNavigationLink = styled((props: LinkProps) => {
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
  ButtonBar: PrimaryNavigationButtonBar,
  Menu: PrimaryNavigationMenu,
  ButtonOverlay: PrimaryNavigationButtonOverlay,
  Sidebar: PrimaryNavigationSidebar,
  SidebarHeader: PrimaryNavigationSidebarHeader,
  FooterItems: PrimaryNavigationFooterItems,
};
