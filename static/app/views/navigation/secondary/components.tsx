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
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import {AnimatePresence, motion} from 'framer-motion';

import {ProjectsBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {useScrollLock} from '@sentry/scraps/useScrollLock';

import {useHovercardContext} from 'sentry/components/hovercard';
import {IconChevron, IconClose, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
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
  const isMobilePageFrame = layout === 'mobile';

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

  return (
    <Container
      background="secondary"
      borderRight="primary"
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
  return (
    <Stack as="ul" margin="0" padding="0" width="100%" gap="2xs">
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
   * Will display the link as active under the given path. Pass a list of paths
   * to display the link as active when any of them match.
   */
  activeTo?: To | To[];
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
  const isCollapsed = view !== 'expanded';
  const isMobilePageFrame = layout === 'mobile';

  return (
    <Grid
      columns="1fr auto"
      align="center"
      borderBottom="primary"
      height={
        isMobilePageFrame
          ? `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`
          : `${PRIMARY_HEADER_HEIGHT}px`
      }
      padding={isMobilePageFrame ? 'md lg' : '0 md 0 xl'}
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
            aria-label={isCollapsed ? t('Expand') : t('Collapse')}
            onClick={() => setView(view === 'expanded' ? 'collapsed' : 'expanded')}
            variant="transparent"
          />
        ) : (
          <Button
            size="xs"
            icon={<IconChevron direction={isCollapsed ? 'right' : 'left'} isDouble />}
            aria-label={isCollapsed ? t('Expand') : t('Collapse')}
            onClick={() => setView(view === 'expanded' ? 'collapsed' : 'expanded')}
            variant={isCollapsed ? 'primary' : 'transparent'}
            analyticsEventName="Sidebar: Secondary Toggle Button Clicked"
            analyticsEventKey="sidebar_secondary_toggle_button_clicked"
            analyticsParams={{
              is_collapsed: isCollapsed,
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
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  trailingItems?: ReactNode;
}

function SectionTitle(props: SectionTitleProps) {
  if (props.canCollapse) {
    return (
      <Grid columns="1fr auto" align="center" width="100%" padding="sm lg">
        {p => (
          <Button
            {...p}
            size="sm"
            variant="transparent"
            onClick={() => props.setIsCollapsed(!props.isCollapsed)}
          >
            <Text bold ellipsis align="left">
              {props.children}
            </Text>
            <Flex align="center" flexShrink={0} aria-hidden="true">
              {props.trailingItems ? (
                <div onClick={e => e.stopPropagation()}>{props.trailingItems}</div>
              ) : (
                props.canCollapse && (
                  <IconChevron
                    direction={props.isCollapsed ? 'down' : 'up'}
                    size="xs"
                    variant="muted"
                  />
                )
              )}
            </Flex>
          </Button>
        )}
      </Grid>
    );
  }

  return (
    <Grid columns="1fr auto" align="center" width="100%" padding="sm lg">
      <Text bold ellipsis align="left">
        {props.children}
      </Text>
      <Flex justify="end" align="center" flexShrink={0}>
        {props.trailingItems}
      </Flex>
    </Grid>
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
  const [isCollapsedState, setIsCollapsedState] = useLocalStorageState(
    `secondary-nav-section-${props.id}-collapsed`,
    false
  );
  const canCollapse = collapsible && layout === 'sidebar';
  const isCollapsed = canCollapse ? isCollapsedState : false;

  return (
    <Container padding="md sm" data-nav-section>
      {props.title ? (
        <SectionTitle
          trailingItems={props.trailingItems}
          canCollapse={canCollapse}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsedState}
        >
          {props.title}
        </SectionTitle>
      ) : null}
      <Collapsible collapsed={isCollapsed} disabled={!canCollapse}>
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
  const activeToList = Array.isArray(activeTo) ? activeTo : [activeTo];
  const isActive =
    incomingIsActive ??
    activeToList.some(path =>
      isPrimaryNavigationLinkActive(path, location.pathname, {end})
    );

  const {layout, features} = usePrimaryNavigation();
  const {reset: closeCollapsedNavigationHovercard} = useHovercardContext();
  const {setView} = useSecondaryNavigation();
  const isMobilePageFrame = layout === 'mobile';

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
  return (
    // Keep the 18×18 nav-specific outer Stack; ProjectsBadge renders at 16×16 inside it.
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
      <ProjectsBadge
        projectPlatforms={props.projectPlatforms}
        allProjects={props.allProjects}
      />
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
          transition={{
            type: 'spring',
            damping: 50,
            stiffness: 600,
            bounce: 0,
            visualDuration: 0.4,
          }}
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
        css={reorderableHandleCoordination}
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

// Render the handle as a sibling of the link, not a child. The browser fires a
// click after a drag, targeted at the common ancestor of mouse-down and mouse-up.
// Mouse-down is on the handle, so keeping it outside the <a> means that click
// can never target the link and navigate. The icon/handle hover swap lives on
// the <li> because it's the only element containing both.
const reorderableHandleCoordination = css`
  [data-reorderable-handle-slot] {
    transition:
      opacity 150ms ease,
      scale 150ms ease;
  }

  &:hover [data-drag-icon],
  &:has(:focus-visible) [data-drag-icon],
  &[data-is-dragging] [data-drag-icon] {
    opacity: 1;
    pointer-events: auto;
  }

  &:hover [data-reorderable-handle-slot],
  &:has(:focus-visible) [data-reorderable-handle-slot],
  &[data-is-dragging] [data-reorderable-handle-slot] {
    opacity: 0;
    scale: 0.95;
  }
`;

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
  const [items, setItems] = useState(props.items);
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
  const activeToList = Array.isArray(activeTo) ? activeTo : [activeTo];
  const isActive =
    incomingIsActive ??
    activeToList.some(path =>
      isPrimaryNavigationLinkActive(path, location.pathname, {end})
    );
  const {layout, features} = usePrimaryNavigation();
  const {reset: closeCollapsedNavigationHovercard} = useHovercardContext();
  const {setView} = useSecondaryNavigation();
  const isMobilePageFrame = layout === 'mobile';

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle modifier clicks so the view opens in a new tab/window.
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
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
  }

  const sharedProps = {
    to,
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
    layout,
    'aria-current': isActive ? ('page' as const) : undefined,
    onClick: handleClick,
  };

  const content = (
    <Fragment>
      <Flex justify="center" align="center" data-reorderable-handle-slot>
        {icon}
      </Flex>
      {children}
      {trailingItems}
    </Fragment>
  );

  return (
    <Fragment>
      <StyledPageFrameReorderableLink {...sharedProps} layout="sidebar">
        {content}
      </StyledPageFrameReorderableLink>
      <GrabHandle />
    </Fragment>
  );
}

function GrabHandle() {
  const {attributes, isDragging, listeners, setActivatorNodeRef} =
    useReorderableItemContext();

  return (
    <Flex
      radius="xs"
      width="18px"
      height="18px"
      justify="center"
      align="center"
      position="absolute"
      top="50%"
    >
      {p => (
        <GrabHandleAnimation
          {...p}
          {...listeners}
          {...attributes}
          aria-label={t('Drag to reorder')}
          data-drag-icon
          ref={setActivatorNodeRef}
          style={{cursor: isDragging ? 'grabbing' : 'grab'}}
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
  /* Overlay the project icon, which sits at the link's left padding. */
  left: ${p => p.theme.space.lg};
  transition: opacity ${p => p.theme.motion.smooth.moderate};
  transform: translateY(-50%);

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

const StyledPageFrameReorderableLink = styled(Link, {
  shouldForwardProp: prop => prop !== 'layout',
})<{
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
  ReorderableList: SecondaryNavigationReorderableList,
  ReorderableLink: SecondaryNavigationReorderableLink,
  Indicator: SecondaryNavigationIndicator,
};
