import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {To} from 'react-router-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {restrictToParentElement, restrictToVerticalAxis} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {css, useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import {AnimatePresence, motion} from 'framer-motion';
import PlatformIcon from 'platformicons/build/platformIcon';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {useScrollLock} from '@sentry/scraps/useScrollLock';

import {
  DropdownMenu,
  type DropdownMenuProps,
  type MenuItemProps,
} from 'sentry/components/dropdownMenu';
import {useHovercardContext} from 'sentry/components/hovercard';
import {
  IconAllProjects,
  IconChevron,
  IconClose,
  IconEllipsis,
  IconGrabbable,
  IconMyProjects,
} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {testableTransition} from 'sentry/utils/testableTransition';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useResizable} from 'sentry/utils/useResizable';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE,
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  PRIMARY_HEADER_HEIGHT,
  SECONDARY_SIDEBAR_MAX_WIDTH,
  SECONDARY_SIDEBAR_MIN_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
  SIDEBAR_NAVIGATION_SOURCE,
} from 'sentry/views/navigation/constants';
import {
  NAVIGATION_TOUR_CONTENT,
  NavigationTour,
  NavigationTourElement,
  useNavigationTour,
  type NavigationTourElementProps,
} from 'sentry/views/navigation/navigationTour';
import {isPrimaryNavigationLinkActive} from 'sentry/views/navigation/primary/components';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

const MotionContainer = motion.create(Container);

interface SecondarySidebarProps {
  children: ReactNode;
}

function SecondarySidebar({children}: SecondarySidebarProps) {
  const {currentStepId} = useNavigationTour();
  const stepId = currentStepId ?? NavigationTour.ISSUES;
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const {layout} = usePrimaryNavigation();

  const [secondarySidebarWidth, setSecondarySidebarWidth] = useSyncedLocalStorageState(
    NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );

  const {onMouseDown: handleStartResize, size} = useResizable({
    ref: resizableContainerRef,
    initialSize: secondarySidebarWidth,
    minWidth: SECONDARY_SIDEBAR_MIN_WIDTH,
    maxWidth: SECONDARY_SIDEBAR_MAX_WIDTH,
    onResizeEnd: newWidth => {
      setSecondarySidebarWidth(newWidth);
    },
  });

  const {activeGroup} = usePrimaryNavigation();
  const hasPageFrame = useHasPageFrameFeature();
  const isMobilePageFrame = hasPageFrame && layout === 'mobile';

  return (
    <SecondarySidebarWrapper
      id={stepId}
      description={NAVIGATION_TOUR_CONTENT[stepId].description}
      title={NAVIGATION_TOUR_CONTENT[stepId].title}
    >
      {({ref, 'aria-expanded': _ariaExpanded, ...props}) => (
        // aria-expanded is omitted here because TourGuide passes it via useOverlay's
        // triggerProps (designed for button/disclosure triggers), but this element is
        // a plain container div with no role that supports aria-expanded. Spreading it
        // would cause a Lighthouse a11y violation: aria-expanded is invalid on a div
        // without a matching ARIA role.
        <Container
          height="100%"
          right="0"
          {...props}
          width={isMobilePageFrame ? '100%' : `${size}px`}
          ref={isMobilePageFrame ? undefined : mergeRefs(resizableContainerRef, ref)}
          {...{
            [NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE]: true,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <MotionContainer
              width="100%"
              height="100%"
              key={activeGroup}
              initial={{x: -6, opacity: 0}}
              animate={{x: 0, opacity: 1}}
              exit={{x: 6, opacity: 0}}
              transition={{duration: 0.06}}
            >
              <Grid
                rows="auto 1fr auto"
                role="navigation"
                aria-label="Secondary Navigation"
                height="100%"
              >
                {children}
              </Grid>
              <Container
                top="0"
                right="0"
                bottom="0"
                width="8px"
                radius="lg"
                position="absolute"
                display={isMobilePageFrame ? 'none' : undefined}
              >
                {p => (
                  <ResizeHandle
                    {...p}
                    ref={resizeHandleRef}
                    onMouseDown={handleStartResize}
                    onDoubleClick={() => {
                      setSecondarySidebarWidth(SECONDARY_SIDEBAR_WIDTH);
                    }}
                    atMinWidth={size === SECONDARY_SIDEBAR_MIN_WIDTH}
                    atMaxWidth={size === SECONDARY_SIDEBAR_MAX_WIDTH}
                  />
                )}
              </Container>
            </MotionContainer>
          </AnimatePresence>
        </Container>
      )}
    </SecondarySidebarWrapper>
  );
}

function SecondarySidebarWrapper(props: NavigationTourElementProps) {
  const theme = useTheme();
  const secondaryNavigation = useSecondaryNavigation();
  const hasPageFrame = useHasPageFrameFeature();
  const {layout} = usePrimaryNavigation();

  return (
    <Container
      background="secondary"
      borderRight={
        hasPageFrame && secondaryNavigation.view === 'expanded' && layout !== 'mobile'
          ? undefined
          : 'primary'
      }
      position="relative"
      height="100%"
    >
      {p => (
        <NavigationTourElement
          {...mergeProps(p, props)}
          style={{zIndex: theme.zIndex.sidebarPanel}}
        />
      )}
    </Container>
  );
}

const ResizeHandle = styled('div')<{atMaxWidth: boolean; atMinWidth: boolean}>`
  z-index: ${p => p.theme.zIndex.drawer + 2};
  cursor: ${p => (p.atMinWidth ? 'e-resize' : p.atMaxWidth ? 'w-resize' : 'ew-resize')};

  &:hover,
  &:active {
    &::after {
      background: ${p => p.theme.tokens.graphics.accent.vibrant};
    }
  }

  &::after {
    content: '';
    position: absolute;
    right: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    opacity: 0.8;
    background: transparent;
    transition: background ${p => p.theme.motion.smooth.slow} 0.1s;
  }
`;

interface SecondaryNavigationListProps {
  children: ReactNode;
}

function SecondaryNavigationList(props: SecondaryNavigationListProps) {
  const hasPageFrame = useHasPageFrameFeature();
  return (
    <Stack as="ul" margin="0" padding="0" width="100%" gap={hasPageFrame ? '2xs' : '0'}>
      {props.children}
    </Stack>
  );
}

interface SecondaryNavigationListItemProps {
  children: ReactNode;
}

function SecondaryNavigationListItem(props: SecondaryNavigationListItemProps) {
  return (
    <Container as="li" style={{listStyleType: 'none'}}>
      {props.children}
    </Container>
  );
}

interface SecondaryNavigationItemProps extends Omit<LinkProps, 'ref' | 'to'> {
  children: ReactNode;
  to: To;
  /**
   * Will display the link as active under the given path.
   */
  activeTo?: To;
  analyticsItemName?: string;
  /**
   * When passed, will not show the link as active for descendant paths.
   * Same as the RR6 `NavLink` `end` prop.
   */
  end?: boolean;
  isActive?: boolean;
  leadingItems?: ReactNode;
  showInteractionStateLayer?: boolean;
  trailingItems?: ReactNode;
}

interface SecondaryNavigationHeaderProps {
  children?: ReactNode;
}

function SecondaryNavigationHeader(props: SecondaryNavigationHeaderProps) {
  const {layout} = usePrimaryNavigation();
  const {view, setView} = useSecondaryNavigation();
  const collapsed = view !== 'expanded';
  const hasPageFrame = useHasPageFrameFeature();
  const isMobilePageFrame = hasPageFrame && layout === 'mobile';

  return (
    <Grid
      columns="1fr auto"
      align="center"
      borderBottom={hasPageFrame ? 'primary' : 'muted'}
      height={
        isMobilePageFrame
          ? `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`
          : layout === 'mobile'
            ? undefined
            : hasPageFrame
              ? `${PRIMARY_HEADER_HEIGHT}px`
              : '44px'
      }
      padding={
        layout === 'mobile' ? (isMobilePageFrame ? 'md lg' : 'md xl') : '0 md 0 xl'
      }
    >
      <div>
        <Text size="md" bold>
          {props.children}
        </Text>
      </div>
      <div>
        {isMobilePageFrame ? (
          <Button
            size="xs"
            icon={<IconClose />}
            aria-label={collapsed ? t('Expand') : t('Collapse')}
            onClick={() => setView(view === 'expanded' ? 'collapsed' : 'expanded')}
            priority="transparent"
          />
        ) : layout === 'mobile' ? null : (
          <Button
            size="xs"
            icon={<IconChevron direction={collapsed ? 'right' : 'left'} isDouble />}
            aria-label={collapsed ? t('Expand') : t('Collapse')}
            onClick={() => setView(view === 'expanded' ? 'collapsed' : 'expanded')}
            priority={collapsed ? 'primary' : 'transparent'}
            analyticsEventName="Sidebar: Secondary Toggle Button Clicked"
            analyticsEventKey="sidebar_secondary_toggle_button_clicked"
            analyticsParams={{
              is_collapsed: collapsed,
            }}
          />
        )}
      </div>
    </Grid>
  );
}

interface SecondaryNavigationBodyProps {
  children: ReactNode;
}

function SecondaryNavigationBody(props: SecondaryNavigationBodyProps) {
  const {layout} = usePrimaryNavigation();

  return (
    <Container
      overflow="auto"
      overscrollBehavior="contain"
      padding={layout === 'mobile' ? '0 0 md 0' : undefined}
    >
      {props.children}
    </Container>
  );
}

interface SectionTitleProps {
  canCollapse: boolean;
  children: ReactNode;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  trailingItems?: ReactNode;
}

function SectionTitle(props: SectionTitleProps) {
  if (props.trailingItems && props.canCollapse) {
    return (
      <Grid columns="1fr auto" align="center" width="100%">
        <Grid columns="1fr auto" align="center" width="100%" padding="sm lg">
          {p => (
            <Fragment>
              <Button
                size="sm"
                priority="transparent"
                onClick={() => props.onCollapsedChange(!props.collapsed)}
                {...p}
              >
                <Text bold ellipsis align="left">
                  {props.children}
                </Text>
              </Button>
              <Flex align="center" flexShrink={0}>
                {props.trailingItems}
                <ChevronButton
                  collapsed={props.collapsed}
                  onClick={() => props.onCollapsedChange(!props.collapsed)}
                />
              </Flex>
            </Fragment>
          )}
        </Grid>
      </Grid>
    );
  }

  if (props.canCollapse) {
    return (
      <Grid columns="1fr auto" align="center" width="100%" padding="sm lg">
        {p => (
          <Button
            size="sm"
            priority="transparent"
            onClick={() => props.onCollapsedChange(!props.collapsed)}
            {...p}
          >
            <Text bold ellipsis align="left">
              {props.children}
            </Text>
            <Flex align="center" flexShrink={0}>
              <ChevronIcon collapsed={props.collapsed} />
            </Flex>
          </Button>
        )}
      </Grid>
    );
  }

  return (
    <Grid columns="1fr auto" align="center" width="100%">
      {props.children}
      {props.trailingItems}
    </Grid>
  );
}

function ChevronIcon(props: {collapsed: boolean}) {
  return (
    <IconChevron direction={props.collapsed ? 'down' : 'up'} size="xs" variant="muted" />
  );
}

function ChevronButton(
  props: Omit<Exclude<ButtonProps, 'children'>, 'aria-label'> & {collapsed: boolean}
) {
  return (
    <Button
      size="xs"
      aria-label={props.collapsed ? t('Expand') : t('Collapse')}
      icon={<ChevronIcon collapsed={props.collapsed} aria-hidden="true" />}
      priority="transparent"
      {...props}
    />
  );
}

interface SecondaryNavigationSectionProps {
  children: ReactNode;
  id: string;
  collapsible?: boolean;
  title?: ReactNode;
  trailingItems?: ReactNode;
}

function SecondaryNavigationSection(props: SecondaryNavigationSectionProps) {
  const collapsible = props.collapsible ?? true;
  const {layout} = usePrimaryNavigation();
  const [collapsedState, onCollapsedChangeState] = useLocalStorageState(
    `secondary-nav-section-${props.id}-collapsed`,
    false
  );
  const canCollapse = collapsible && layout === 'sidebar';
  const collapsed = canCollapse ? collapsedState : false;

  return (
    <Container padding="md sm" data-nav-section>
      {props.title ? (
        <SectionTitle
          trailingItems={props.trailingItems}
          canCollapse={canCollapse}
          collapsed={collapsed}
          onCollapsedChange={onCollapsedChangeState}
        >
          {props.title}
        </SectionTitle>
      ) : null}
      <Collapsible collapsed={collapsed} disabled={!canCollapse}>
        {props.children}
      </Collapsible>
    </Container>
  );
}

function SecondaryNavigationLink({
  analyticsItemName,
  children,
  to,
  activeTo = to,
  isActive: incomingIsActive,
  end = false,
  leadingItems,
  trailingItems,
  onClick,
  ...linkProps
}: SecondaryNavigationItemProps) {
  const organization = useOrganization();
  const location = useLocation();
  const isActive =
    incomingIsActive ?? isPrimaryNavigationLinkActive(activeTo, location.pathname, {end});

  const {layout, features} = usePrimaryNavigation();
  const {reset: closeCollapsedNavigationHovercard} = useHovercardContext();
  const hasPageFrame = useHasPageFrameFeature();
  const {setView} = useSecondaryNavigation();
  const isMobilePageFrame = hasPageFrame && layout === 'mobile';

  const sharedLinkProps = {
    ...linkProps,
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
    to,
    'aria-current': isActive ? ('page' as const) : undefined,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (analyticsItemName) {
        trackAnalytics('navigation.secondary_item_clicked', {
          item: analyticsItemName,
          organization,
        });
      }

      // When this is rendered inside a hovercard (when the nav is collapsed)
      // this will dismiss it when clicking on a link.
      closeCollapsedNavigationHovercard();

      // On touch devices with page frame, close the nav panel when navigating to a secondary item.
      // MobilePageFrameNavigation watches for view === 'collapsed' and calls setIsOpen(false).
      if (isMobilePageFrame && !features.hover) {
        setView('collapsed');
      }

      onClick?.(e);
    },
  };

  if (hasPageFrame) {
    return (
      <PageFrameSidebarNavigationLink {...sharedLinkProps}>
        {leadingItems}
        <Text ellipsis variant="inherit">
          {children}
        </Text>
        {trailingItems}
      </PageFrameSidebarNavigationLink>
    );
  }

  if (layout === 'mobile') {
    return (
      <MobileNavigationLink {...sharedLinkProps}>
        {leadingItems}
        <Text ellipsis>{children}</Text>
        {trailingItems}
      </MobileNavigationLink>
    );
  }

  return (
    <SidebarNavigationLink {...sharedLinkProps}>
      {leadingItems}
      <Text ellipsis variant="inherit">
        {children}
      </Text>
      {trailingItems}
    </SidebarNavigationLink>
  );
}

function SecondaryNavigationSeparator() {
  return (
    <Container padding="0 xl">
      <Separator orientation="horizontal" border="muted" />
    </Container>
  );
}

interface SecondaryNavigationProjectIconProps {
  projectPlatforms: string[];
  allProjects?: boolean;
}

function SecondaryNavigationProjectIcon(props: SecondaryNavigationProjectIconProps) {
  let icons: React.ReactNode;

  switch (props.projectPlatforms.length) {
    case 0:
      icons = props.allProjects ? (
        <IconAllProjects size="md" aria-hidden="true" />
      ) : (
        <IconMyProjects size="md" aria-hidden="true" />
      );
      break;
    case 1:
      icons = (
        <PlatformIcon platform={props.projectPlatforms[0]!} size={16} aria-hidden />
      );
      break;
    default:
      icons = (
        <Fragment>
          <Container position="absolute" top="0" right="6px" width="12px" height="12px">
            {p => (
              <PlatformIcon
                {...p}
                platform={props.projectPlatforms[0]!}
                size={12}
                aria-hidden
              />
            )}
          </Container>
          <Container position="absolute" bottom="0" right="0" width="12px" height="12px">
            {p => (
              <PlatformIcon
                {...p}
                platform={props.projectPlatforms[1]!}
                size={12}
                aria-hidden
              />
            )}
          </Container>
        </Fragment>
      );
  }

  return (
    <Stack
      flexShrink={0}
      justify="center"
      align="center"
      width="18px"
      height="18px"
      position="relative"
      data-project-icon
      aria-hidden="true"
    >
      {icons}
    </Stack>
  );
}

interface CollapsibleProps {
  children: React.ReactNode;
  collapsed: boolean;
  disabled?: boolean;
}

function Collapsible(props: CollapsibleProps) {
  if (props.disabled) {
    return props.children;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!props.collapsed && (
        <MotionFlex
          // This column-reverse is what creates the "folder" animation effect, where children "fall out" of the header
          // when un-collapsed, and are "sucked in" to the header when collapsed, rather than a standard accordion effect.
          direction="column-reverse"
          key="collapsible-content"
          variants={{
            collapsed: {
              height: 0,
              overflow: 'hidden',
            },
            expanded: {
              height: 'auto',
            },
          }}
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          transition={testableTransition({
            type: 'spring',
            damping: 50,
            stiffness: 600,
            bounce: 0,
            visualDuration: 0.4,
          })}
        >
          {/*
            We need to wrap the children in a div to prevent the parent's flex-direction: column-reverse
            from applying to the children, which may cause the children's order to be reversed
          */}
          <div>{props.children}</div>
        </MotionFlex>
      )}
    </AnimatePresence>
  );
}

const MotionFlex = motion.create(Flex);

function navigationItemStyles(p: {layout: 'mobile' | 'sidebar'; theme: Theme}) {
  return css`
    display: flex;
    gap: ${p.theme.space.sm};
    justify-content: center;
    align-items: center;
    position: relative;
    color: ${p.theme.tokens.interactive.link.neutral.rest};
    /* We need to cap the height at md size as some items like the reorderable link with icons
     * will otherwise cause the links to be taller, visually standing out when they are laid out in a list */
    height: ${p.theme.form.sm.height};
    padding: ${p.layout === 'mobile'
      ? `${p.theme.space.sm} ${p.theme.space.lg} ${p.theme.space.sm} ${p.theme.space.lg}`
      : `${p.theme.space.md} ${p.theme.space.lg}`};
    border-radius: ${p.theme.radius[p.layout === 'mobile' ? '0' : 'md']};

    /* Renders the active state indicator */
    &::before {
      content: '';
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 20px;
      left: -${p.theme.space.sm};
      border-radius: ${p.theme.radius['2xs']};
      background-color: ${p.theme.tokens.graphics.accent.vibrant};
      transition: opacity ${p.theme.motion.smooth.fast};
      opacity: 0;
    }

    &:hover {
      color: ${p.theme.tokens.interactive.link.neutral.hover};
      background-color: ${p.theme.tokens.interactive.transparent.neutral.background
        .hover};
    }

    &[aria-current='page'] {
      color: ${p.theme.tokens.interactive.link.accent.rest};
      background-color: ${p.theme.tokens.interactive.transparent.accent.selected
        .background.rest};

      &::before {
        opacity: 1;
      }

      &:hover {
        color: ${p.theme.tokens.interactive.link.accent.hover};
        background-color: ${p.theme.tokens.interactive.transparent.accent.selected
          .background.hover};
      }
    }
  `;
}

const MobileNavigationLink = styled(Link)`
  display: flex;
  gap: ${p => p.theme.space.sm};
  justify-content: center;
  align-items: center;
  position: relative;
  padding: ${p =>
    `${p.theme.space.sm} ${p.theme.space.lg} ${p.theme.space.sm} ${p.theme.space.lg}`};
  border-radius: ${p => p.theme.radius['0']};
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};

  /* Renders the active state indicator */
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 20px;
    left: -${p => p.theme.space.sm};
    border-radius: ${p => p.theme.radius['2xs']};
    background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    transition: opacity ${p => p.theme.motion.smooth.fast};
    opacity: 0;
  }

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &[aria-current='page'] {
    color: ${p => p.theme.tokens.interactive.link.accent.rest};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};

    &::before {
      opacity: 1;
    }

    &:hover {
      color: ${p => p.theme.tokens.interactive.link.accent.hover};
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.hover};
    }
  }
`;

/**
 * A custom PointerSensor that only activates for mouse and pen pointer events,
 * not touch events. This ensures that touch navigation (tapping) works normally.
 */
class NavigationPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({nativeEvent: event}: React.PointerEvent): boolean => {
        if (!event.isPrimary || event.button !== 0 || event.pointerType === 'touch') {
          return false;
        }
        return true;
      },
    },
  ];
}

const ReorderableItemContext = createContext<{
  attributes: ReturnType<typeof useSortable>['attributes'];
  isDragging: boolean;
  listeners: ReturnType<typeof useSortable>['listeners'];
  setActivatorNodeRef: ReturnType<typeof useSortable>['setActivatorNodeRef'];
} | null>(null);

function useReorderableItemContext() {
  const ctx = useContext(ReorderableItemContext);
  if (!ctx) {
    throw new Error(
      'SecondaryNavigation.ReorderableLink must be used within SecondaryNavigation.ReorderableList'
    );
  }
  return ctx;
}

interface ReorderableListItemProps<T extends {id: string | number}> {
  children: ReactNode;
  item: T;
}

function ReorderableListItem<T extends {id: string | number}>(
  props: ReorderableListItemProps<T>
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({id: props.item.id});

  return (
    <ReorderableItemContext.Provider
      value={{attributes, isDragging, listeners, setActivatorNodeRef}}
    >
      <Container
        as="li"
        radius="md"
        position="relative"
        background={isDragging ? 'secondary' : undefined}
        ref={setNodeRef}
        data-is-dragging={isDragging ? true : undefined}
        style={{
          listStyleType: 'none',
          transform: CSS.Transform.toString(transform),
          transition: transition ?? undefined,
          zIndex: isDragging ? 1 : undefined,
        }}
      >
        {props.children}
      </Container>
    </ReorderableItemContext.Provider>
  );
}

interface SecondaryNavigationReorderableSectionProps extends SecondaryNavigationSectionProps {
  children: ReactNode;
}

function SecondaryNavigationReorderableSection(
  props: SecondaryNavigationReorderableSectionProps
) {
  return (
    <SecondaryNavigationSection {...props}>{props.children}</SecondaryNavigationSection>
  );
}

interface SecondaryNavigationReorderableListProps<T extends {id: string | number}> {
  children: (item: T) => ReactNode;
  items: T[];
  onDragEnd: (items: T[]) => void;
}

function SecondaryNavigationReorderableList<T extends {id: string | number}>(
  props: SecondaryNavigationReorderableListProps<T>
) {
  const sensors = useSensors(
    useSensor(NavigationPointerSensor, {
      activationConstraint: {distance: 5},
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // We need to hold a copy of the local state because dnd-kit does not play well
  // with the optimistic updates and async state.
  // See: https://github.com/clauderic/dnd-kit/issues/921
  const [items, setItems] = useState<T[]>(props.items);
  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setItems(props.items);
  }, [props.items]);

  // During a keyboard-driven drag, lock page scroll so ArrowUp/Down don't
  // scroll the sidebar behind the dragged item.
  const scrollLock = useScrollLock(document.body);

  function handleDragEnd(event: DragEndEvent) {
    scrollLock.release();
    const {active, over} = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      props.onDragEnd(newItems);
      setItems(newItems);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={() => scrollLock.acquire()}
      onDragEnd={handleDragEnd}
      onDragCancel={() => scrollLock.release()}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <SecondaryNavigation.List>
          {items.map(item => (
            <ReorderableListItem key={item.id} item={item}>
              {props.children(item)}
            </ReorderableListItem>
          ))}
        </SecondaryNavigation.List>
      </SortableContext>
    </DndContext>
  );
}

interface SecondaryNavigationOverflowMenuProps extends Omit<
  DropdownMenuProps,
  'triggerProps' | 'trigger'
> {
  items: MenuItemProps[];
}

function SecondaryNavigationOverflowMenu(props: SecondaryNavigationOverflowMenuProps) {
  const theme = useTheme();
  const portalContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  return (
    <DropdownMenu
      size="sm"
      position="bottom-end"
      usePortal
      zIndex={theme.zIndex.modal}
      portalContainerRef={portalContainerRef}
      trigger={triggerProps => (
        <IconDefaultsProvider size="xs">
          <CondensedButton
            {...triggerProps}
            size="xs"
            priority="transparent"
            icon={<IconEllipsis />}
            aria-label={t('Section Options')}
          />
        </IconDefaultsProvider>
      )}
      {...props}
    />
  );
}

const CondensedButton = styled(Button)`
  width: 18px;
  height: 18px;
`;

interface SecondaryNavigationReorderableLinkProps extends Omit<
  SecondaryNavigationItemProps,
  'leadingItems' | 'onClick'
> {
  icon: ReactNode;
  onNavigate?: () => void;
}

function SecondaryNavigationReorderableLink({
  analyticsItemName,
  children,
  to,
  activeTo = to,
  isActive: incomingIsActive,
  end = false,
  icon,
  trailingItems,
  onNavigate,
}: SecondaryNavigationReorderableLinkProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const isActive =
    incomingIsActive ?? isPrimaryNavigationLinkActive(activeTo, location.pathname, {end});
  const {layout, features} = usePrimaryNavigation();
  const {reset: closeCollapsedNavigationHovercard} = useHovercardContext();
  const {isDragging} = useReorderableItemContext();
  const hasPageFrame = useHasPageFrameFeature();
  const {setView} = useSecondaryNavigation();
  const isMobilePageFrame = hasPageFrame && layout === 'mobile';

  function handleNavigate() {
    if (isDragging) {
      return;
    }
    if (analyticsItemName) {
      trackAnalytics('navigation.secondary_item_clicked', {
        item: analyticsItemName,
        organization,
      });
    }
    closeCollapsedNavigationHovercard();

    // On touch devices with page frame, close the nav panel when navigating to a secondary item.
    // MobilePageFrameNavigation watches for view === 'collapsed' and calls setIsOpen(false).
    if (isMobilePageFrame && !features.hover) {
      setView('collapsed');
    }

    onNavigate?.();
    navigate(to, {state: {source: SIDEBAR_NAVIGATION_SOURCE}});
  }

  const sharedProps = {
    role: 'link' as const,
    tabIndex: 0,
    layout,
    isDragging,
    'aria-current': isActive ? ('page' as const) : undefined,
    onClick: handleNavigate,
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      // When the grab handle has focus, dnd-kit owns Space/Enter for pick-up
      // and drop. Without this guard those keys would also trigger navigation
      // via bubbling, making the drop action unreliable.
      if ((e.target as HTMLElement).closest('[data-drag-icon]')) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNavigate();
      }
    },
  };

  const content = (
    <Fragment>
      <Flex justify="center" align="center" position="relative">
        <GrabHandle />
        <Flex justify="center" align="center" data-reorderable-handle-slot>
          {icon}
        </Flex>
      </Flex>
      {children}
      {trailingItems}
    </Fragment>
  );

  if (hasPageFrame) {
    return (
      <StyledPageFrameReorderableFakeLink {...sharedProps} layout="sidebar">
        {content}
      </StyledPageFrameReorderableFakeLink>
    );
  }

  if (layout === 'mobile') {
    return (
      <StyledReorderableFakeLink {...sharedProps}>{content}</StyledReorderableFakeLink>
    );
  }

  return (
    <StyledReorderableFakeLink {...sharedProps}>{content}</StyledReorderableFakeLink>
  );
}

function GrabHandle(props: FlexProps<'div'>) {
  const {attributes, isDragging, listeners, setActivatorNodeRef} =
    useReorderableItemContext();

  return (
    <Flex
      radius="xs"
      width="24px"
      height="24px"
      justify="center"
      align="center"
      position="absolute"
      top="50%"
      left="50%"
    >
      {p => (
        <GrabHandleAnimation
          {...props}
          {...p}
          {...listeners}
          {...attributes}
          aria-label={t('Drag to reorder')}
          data-drag-icon
          ref={setActivatorNodeRef}
          style={{cursor: isDragging ? 'grabbing' : 'grab'}}
          onClick={e => e.stopPropagation()}
        >
          <IconGrabbable variant="muted" aria-hidden="true" />
        </GrabHandleAnimation>
      )}
    </Flex>
  );
}

const GrabHandleAnimation = styled('div')`
  pointer-events: none;
  opacity: 0;
  z-index: 1;
  transition:
    opacity ${p => p.theme.motion.smooth.moderate},
    transform ${p => p.theme.motion.smooth.moderate};
  transform: translate(-50%, -50%);

  &:active {
    cursor: grabbing;
  }
  &:focus-visible {
    ${p => p.theme.focusRing()}
  }
`;

interface SecondaryNavigationIndicatorProps {
  variant: 'accent' | 'danger' | 'warning';
  ref?: React.Ref<HTMLDivElement>;
}

function SecondaryNavigationIndicator(props: SecondaryNavigationIndicatorProps) {
  const {ref, variant, ...rest} = props;
  return (
    <Container
      position="absolute"
      top="0"
      right="0"
      width="10px"
      height="10px"
      radius="full"
      {...rest}
    >
      {p => <DotIndicator ref={ref} {...p} variant={variant} />}
    </Container>
  );
}

const DotIndicator = styled('div')<{variant: 'accent' | 'danger' | 'warning'}>`
  background: ${p => p.theme.tokens.graphics[p.variant].vibrant};
  border: 2px solid ${p => p.theme.tokens.border[p.variant].muted};
`;

const StyledReorderableFakeLink = styled('div')<{
  isDragging: boolean;
  layout: 'mobile' | 'sidebar';
}>`
  ${p => navigationItemStyles(p)}
  cursor: pointer;
  user-select: none;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }

  :hover,
  :has(:focus-visible) {
    [data-drag-icon] {
      opacity: 1;
      scale: 1;
      pointer-events: auto;
    }
  }

  ${p =>
    p.isDragging &&
    css`
      [data-drag-icon] {
        opacity: 1;
        scale: 1;
        pointer-events: auto;
      }
    `}

  [data-reorderable-handle-slot] {
    transition:
      opacity 150ms ease,
      scale 150ms ease;
  }

  :hover [data-reorderable-handle-slot],
  :has(:focus-visible) [data-reorderable-handle-slot] {
    opacity: 0;
    scale: 0.95;
  }

  ${p =>
    p.isDragging &&
    css`
      [data-reorderable-handle-slot] {
        opacity: 0;
        scale: 0.95;
      }
    `}
`;

const StyledPageFrameReorderableFakeLink = styled('div')<{
  isDragging: boolean;
  layout: 'mobile' | 'sidebar';
}>`
  display: flex;
  gap: ${p => p.theme.space.sm};
  justify-content: center;
  align-items: center;
  position: relative;
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  /* We need to cap the height at sm size as some items like the reorderable link with icons
   * will otherwise cause the links to be taller, visually standing out when they are laid out in a list */
  height: ${p => p.theme.form.sm.height};
  padding: ${p => `${p.theme.space.md} ${p.theme.space.lg}`};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
    border-color: ${p => p.theme.tokens.border.transparent.neutral.muted};
  }

  &:active {
    color: ${p => p.theme.tokens.content.primary};
    border: 1px solid ${p => p.theme.tokens.interactive.transparent.accent.border};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.accent.background.active};
  }

  &[aria-current='page'] {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    border-color: ${p => p.theme.tokens.border.transparent.accent.muted};
    color: ${p => p.theme.tokens.content.primary};

    &:hover {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.hover};
    }
  }

  :hover,
  :has(:focus-visible) {
    [data-drag-icon] {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
      pointer-events: auto;
    }
  }

  [data-reorderable-handle-slot] {
    transition:
      opacity ${p => p.theme.motion.smooth.moderate},
      transform ${p => p.theme.motion.smooth.moderate};
    opacity: ${p => (p.isDragging ? 0 : undefined)};
    transform: ${p => (p.isDragging ? 'scale(0.95)' : 'scale(1)')};
  }

  :hover [data-reorderable-handle-slot],
  :has(:focus-visible) [data-reorderable-handle-slot] {
    opacity: 0;
    transform: scale(0.95);
  }

  [data-drag-icon] {
    opacity: ${p => (p.isDragging ? 1 : undefined)};
    transform: ${p => (p.isDragging ? 'translate(-50%, -50%) scale(1)' : undefined)};
    pointer-events: ${p => (p.isDragging ? 'auto' : undefined)};
  }
`;

const SidebarNavigationLink = styled(Link)`
  display: flex;
  gap: ${p => p.theme.space.sm};
  justify-content: center;
  align-items: center;
  position: relative;
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  padding: ${p => `${p.theme.space.md} ${p.theme.space.lg}`};
  border-radius: ${p => p.theme.radius.md};

  /* Renders the active state indicator */
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 20px;
    left: -${p => p.theme.space.sm};
    border-radius: ${p => p.theme.radius['2xs']};
    background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    transition: opacity ${p => p.theme.motion.smooth.fast};
    opacity: 0;
  }

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &[aria-current='page'] {
    color: ${p => p.theme.tokens.interactive.link.accent.rest};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};

    &::before {
      opacity: 1;
    }

    &:hover {
      color: ${p => p.theme.tokens.interactive.link.accent.hover};
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.hover};
    }
  }
`;

const PageFrameSidebarNavigationLink = styled(Link)`
  display: flex;
  gap: ${p => p.theme.space.sm};
  justify-content: center;
  align-items: center;
  position: relative;
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  /* We need to cap the height at sm size as some items like the reorderable link with icons
   * will otherwise cause the links to be taller, visually standing out when they are laid out in a list */
  height: ${p => p.theme.form.sm.height};
  padding: ${p => `${p.theme.space.md} ${p.theme.space.lg}`};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid transparent;

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
    border-color: ${p => p.theme.tokens.border.transparent.neutral.muted};
  }

  &:active {
    color: ${p => p.theme.tokens.content.primary};
    border: 1px solid ${p => p.theme.tokens.interactive.transparent.accent.border};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.accent.background.active};
  }

  &[aria-current='page'] {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    border-color: ${p => p.theme.tokens.border.transparent.accent.muted};
    color: ${p => p.theme.tokens.content.primary};

    &:hover {
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.hover};
    }
  }
`;

export const SecondaryNavigation = {
  Header: SecondaryNavigationHeader,
  Body: SecondaryNavigationBody,
  Section: SecondaryNavigationSection,
  Separator: SecondaryNavigationSeparator,
  List: SecondaryNavigationList,
  ListItem: SecondaryNavigationListItem,
  Link: SecondaryNavigationLink,
  ProjectIcon: SecondaryNavigationProjectIcon,
  Sidebar: SecondarySidebar,
  ReorderableSection: SecondaryNavigationReorderableSection,
  ReorderableList: SecondaryNavigationReorderableList,
  ReorderableLink: SecondaryNavigationReorderableLink,
  Indicator: SecondaryNavigationIndicator,
  OverflowMenu: SecondaryNavigationOverflowMenu,
};
