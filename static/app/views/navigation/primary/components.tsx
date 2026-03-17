import {Fragment, useEffect, useRef, type MouseEventHandler} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {mergeProps} from '@react-aria/utils';
import type {LocationDescriptor} from 'history';

import {FeatureBadge, type FeatureBadgeProps} from '@sentry/scraps/badge';
import type {ButtonProps} from '@sentry/scraps/button';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
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
  PRIMARY_HEADER_HEIGHT,
  PRIMARY_SIDEBAR_WIDTH,
  SIDEBAR_NAVIGATION_SOURCE,
} from 'sentry/views/navigation/constants';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';

function usePrimaryNavigationOrganization() {
  return useOrganization({allowNull: true});
}

interface PrimaryNavigationSidebarProps {
  children: React.ReactNode;
  'data-test-id'?: string;
}

function PrimaryNavigationSidebar({children, ...props}: PrimaryNavigationSidebarProps) {
  const theme = useTheme();
  const organization = usePrimaryNavigationOrganization();
  const hasPageFrame = organization?.features.includes('page-frame');

  if (hasPageFrame) {
    return (
      <Grid
        as="nav"
        aria-label={t('Primary Navigation')}
        borderRight="primary"
        background="primary"
        columns="1fr"
        rows={`${PRIMARY_HEADER_HEIGHT}px 1fr min-content`}
        width={`${PRIMARY_SIDEBAR_WIDTH}px`}
        style={{zIndex: theme.zIndex.sidebarPanel}}
        {...props}
      >
        {children}
      </Grid>
    );
  }

  return (
    <Flex
      as="nav"
      aria-label={t('Primary Navigation')}
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      padding="lg 0 md 0"
      borderRight="primary"
      background="primary"
      direction="column"
      align="center"
      justify="between"
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
  const organization = usePrimaryNavigationOrganization();
  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  const hasPageFrame = organization?.features.includes('page-frame');

  return (
    <Flex
      as="header"
      direction="column"
      align="center"
      justify="center"
      position="relative"
      borderBottom={hasPageFrame ? 'muted' : undefined}
      width={hasPageFrame ? '100%' : undefined}
      {...props}
    >
      {props.children}
      {showSuperuserWarning && (
        <Container
          position="absolute"
          top={`-${theme.space.lg}`}
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
  );
}

interface PrimaryNavigationListProps extends FlexProps<'ul'> {}

function PrimaryNavigationList({children, ...props}: PrimaryNavigationListProps) {
  const {layout} = usePrimaryNavigation();
  const organization = usePrimaryNavigationOrganization();
  const hasPageFrame = organization?.features.includes('page-frame');

  return (
    <Stack
      as="ul"
      position="relative"
      margin="0"
      padding="0"
      width="100%"
      gap={hasPageFrame ? undefined : 'xs'}
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
  const organization = usePrimaryNavigationOrganization();
  const {layout} = usePrimaryNavigation();
  const hasPageFrame = organization?.features.includes('page-frame');
  // Reload the page when the frontend is stale to ensure users get the latest version
  const {state: appState} = useFrontendVersion();

  const sharedLinkProps = {
    to: props.to,
    reloadDocument: appState === 'stale',
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
    'aria-selected': props['aria-selected'],
    'aria-current': props['aria-current'],
    onMouseEnter: props.onMouseEnter,
    onMouseLeave: props.onMouseLeave,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      trackAnalytics('navigation.primary_item_clicked', {
        item: props.analyticsKey,
        organization,
        ...props.analyticsParams,
      });
      props.onClick?.(e);
    },
    [NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE]: true,
  };

  if (layout === 'mobile') {
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
        padding="sm"
        radius="md"
        data-icon-container
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
  buttonProps?: Omit<ButtonProps, 'aria-label'>;
  children?: React.ReactNode;
  indicator?: 'accent' | 'danger' | 'warning';
}

function PrimaryNavigationButton(props: PrimaryNavigationButtonProps) {
  const {layout} = usePrimaryNavigation();
  const organization = usePrimaryNavigationOrganization();

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
        {layout === 'mobile' ? props.label : null}
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
  return (
    <Container
      position="absolute"
      top={layout === 'mobile' ? `-${theme.space.xs}` : '0'}
      right={layout === 'mobile' ? 'auto' : '0px'}
      left={layout === 'mobile' ? '11px' : 'auto'}
    >
      {p => (
        <StatusIndicator
          {...mergeProps(p, props)}
          variant={variant === 'accent' ? 'info' : variant}
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
  size?: ButtonProps['size'];
  triggerWrap?: React.ComponentType<{children: React.ReactNode}>;
}

function PrimaryNavigationMenu(props: PrimaryNavigationMenuProps) {
  const TriggerWrap = props.triggerWrap ?? Fragment;
  const theme = useTheme();
  const organization = usePrimaryNavigationOrganization();
  const {layout} = usePrimaryNavigation();

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
              title={props.label}
              disabled={layout === 'mobile'}
              position="right"
              skipWrapper
              delay={600}
            >
              <NavigationButton
                {...triggerProps}
                aria-label={layout === 'mobile' ? undefined : props.label}
                size={props.size}
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
                {layout === 'mobile' ? (
                  <Fragment>
                    {props.label}
                    {props.children}
                  </Fragment>
                ) : (
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

function NavigationButton(props: ButtonProps) {
  const {layout} = usePrimaryNavigation();

  return (
    <Flex
      align="center"
      height={layout === 'mobile' ? 'auto' : '44px'}
      width={layout === 'mobile' ? '100%' : '44px'}
      padding={layout === 'mobile' ? 'md lg' : 'xs'}
      justify={layout === 'mobile' ? 'start' : 'center'}
    >
      {p => (
        <Button
          {...p}
          {...props}
          size={layout === 'mobile' ? 'zero' : props.size}
          priority={layout === 'mobile' ? 'transparent' : props.priority}
        />
      )}
    </Flex>
  );
}

// Force all buttons to the same size
const PrimaryNavigationButtonBar = styled(ButtonBar)`
  button {
    width: ${p => p.theme.form.md.height};
    height: ${p => p.theme.form.md.height};
  }
`;

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
        <PrimaryNavigation.ButtonBar orientation="vertical">
          {props.children}
        </PrimaryNavigation.ButtonBar>
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
  &[aria-selected='true'] {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};

    [data-icon-container] {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }

  &[aria-current='page'] {
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
  &[aria-selected='true'] {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};

    [data-icon-container] {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }

  &[aria-current='page'] {
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

const DesktopPageFrameNavigationLink = styled((props: LinkProps) => (
  <Flex
    position="relative"
    width="100%"
    align="center"
    direction="column"
    justify="center"
    gap="xs"
    padding="md 0 xs 0"
  >
    {p => <Link {...mergeProps(p, props)} />}
  </Flex>
))`
  outline: none;
  box-shadow: none;
  transition: none;

  color: ${p => p.theme.tokens.interactive.link.neutral.rest};

  [data-icon-container] {
    border: 1px solid transparent;
  }

  &:hover,
  &[aria-selected='true'] {
    [data-icon-container] {
      border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }

    * {
      color: ${p => p.theme.tokens.interactive.link.neutral.hover} !important;
    }
  }

  &:focus-visible {
    box-shadow: none;
    outline: none;

    * {
      color: ${p => p.theme.tokens.interactive.link.neutral.rest} !important;
    }

    [data-icon-container] {
      ${p => p.theme.focusRing()}
    }
  }

  &[aria-current='page'] {
    [data-icon-container] {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
      border: 1px solid ${p => p.theme.tokens.border.transparent.accent.muted};
    }

    * {
      color: ${p => p.theme.tokens.content.primary} !important;
    }
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
  const organization = usePrimaryNavigationOrganization();
  const hasPageFrame = organization?.features.includes('page-frame');

  if (hasPageFrame) {
    return null;
  }

  return (
    <Container right="6px" top="0px" position="absolute" padding="0 xs" height="16px">
      {p => (
        <FeatureBadge
          {...mergeProps(p, props)}
          aria-hidden="true"
          style={{fontSize: '11px', pointerEvents: 'none'}}
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
