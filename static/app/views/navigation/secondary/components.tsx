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
import {restrictToVerticalAxis} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import {AnimatePresence, motion} from 'framer-motion';
import PlatformIcon from 'platformicons/build/platformIcon';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {useHovercardContext} from 'sentry/components/hovercard';
import {IconAllProjects, IconChevron, IconGrabbable, IconMyProjects} from 'sentry/icons';
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
  NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE,
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
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

  return (
    <SecondarySidebarWrapper
      id={stepId}
      description={NAVIGATION_TOUR_CONTENT[stepId].description}
      title={NAVIGATION_TOUR_CONTENT[stepId].title}
    >
      {({ref, ...props}) => (
        <Container
          width={size}
          height="100%"
          right="0"
          {...props}
          ref={mergeRefs(resizableContainerRef, ref)}
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
                position="absolute"
                right="0"
                top="0"
                bottom="0"
                width="8px"
                radius="lg"
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
    transition: background 0.25s ease 0.1s;
  }
`;

interface SecondaryNavigationListProps {
  children: ReactNode;
}

function SecondaryNavigationList(props: SecondaryNavigationListProps) {
  return (
    <Stack as="ul" margin="0" padding="0" width="100%">
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
  const isCollapsed = view !== 'expanded';

  return (
    <Grid
      columns="1fr auto"
      align="center"
      borderBottom="muted"
      height={layout === 'mobile' ? undefined : '44px'}
      padding={layout === 'mobile' ? 'md xl' : '0 md 0 xl'}
    >
      <div>
        <Text size="md" bold>
          {props.children}
        </Text>
      </div>
      <div>
        {layout === 'mobile' ? null : (
          <Button
            size="xs"
            icon={<IconChevron direction={isCollapsed ? 'right' : 'left'} isDouble />}
            aria-label={isCollapsed ? t('Expand') : t('Collapse')}
            onClick={() => setView(view === 'expanded' ? 'collapsed' : 'expanded')}
            priority={isCollapsed ? 'primary' : 'transparent'}
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
            priority="transparent"
            onClick={() => props.setIsCollapsed(!props.isCollapsed)}
          >
            <Text bold ellipsis align="left">
              {props.children}
            </Text>
            <Flex align="center" flexShrink={0}>
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
  const isActive =
    incomingIsActive ?? isPrimaryNavigationLinkActive(activeTo, location.pathname, {end});

  const {layout} = usePrimaryNavigation();
  const {reset: closeCollapsedNavigationHovercard} = useHovercardContext();

  return (
    <NavigationLink
      {...linkProps}
      state={{source: SIDEBAR_NAVIGATION_SOURCE}}
      to={to}
      aria-current={isActive ? 'page' : undefined}
      aria-selected={isActive}
      layout={layout}
      onClick={e => {
        if (analyticsItemName) {
          trackAnalytics('navigation.secondary_item_clicked', {
            item: analyticsItemName,
            organization,
          });
        }

        // When this is rendered inside a hovercard (when the nav is collapsed)
        // this will dismiss it when clicking on a link.
        closeCollapsedNavigationHovercard();
        onClick?.(e);
      }}
    >
      {leadingItems}
      <Text ellipsis variant={layout === 'sidebar' ? 'muted' : undefined}>
        {children}
      </Text>
      {trailingItems}
    </NavigationLink>
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
        <IconAllProjects size="md" />
      ) : (
        <IconMyProjects size="md" />
      );
      break;
    case 1:
      icons = <PlatformIcon platform={props.projectPlatforms[0]!} size={16} />;
      break;
    default:
      icons = (
        <Fragment>
          <Container position="absolute" top="0" left="0" width="14px" height="14px">
            {p => <PlatformIcon {...p} platform={props.projectPlatforms[0]!} size={12} />}
          </Container>
          <Container position="absolute" bottom="0" right="0" width="14px" height="14px">
            {p => <PlatformIcon {...p} platform={props.projectPlatforms[1]!} size={12} />}
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
      data-project-icon
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

interface NavigationLink extends LinkProps {
  layout: 'mobile' | 'sidebar';
}

const NavigationLink = styled(Link)<NavigationLink>`
  display: flex;
  gap: ${p => p.theme.space.sm};
  justify-content: center;
  align-items: center;
  position: relative;
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  padding: ${p =>
    p.layout === 'mobile'
      ? `${p.theme.space.sm} ${p.theme.space.lg} ${p.theme.space.sm} ${p.theme.space.lg}`
      : `${p.theme.space.md} ${p.theme.space.lg}`};
  border-radius: ${p => p.theme.radius[p.layout === 'mobile' ? '0' : 'md']};

  /* Disable interaction state layer */
  > [data-isl] {
    display: none;
  }

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
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
  }

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &[aria-selected='true'] {
    color: ${p => p.theme.tokens.interactive.link.accent.rest};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};

    &::before {
      opacity: 1;
    }
    /* Override the default hover styles */
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
        radius="md"
        position="relative"
        background={isDragging ? 'secondary' : undefined}
      >
        {p => (
          <div
            {...p}
            ref={setNodeRef}
            data-is-dragging={isDragging ? true : undefined}
            style={{
              transform: CSS.Transform.toString(transform),
              transition: transition ?? undefined,
              zIndex: isDragging ? 1 : undefined,
            }}
          >
            {props.children}
          </div>
        )}
      </Container>
    </ReorderableItemContext.Provider>
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
  const [items, setItems] = useState<T[]>(props.items);

  const sensors = useSensors(
    useSensor(NavigationPointerSensor, {
      activationConstraint: {distance: 5},
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      props.onDragEnd(newItems);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <Stack direction="column" padding="0" width="100%">
          {items.map(item => (
            <ReorderableListItem key={item.id} item={item}>
              {props.children(item)}
            </ReorderableListItem>
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}

interface SecondaryNavigationReorderableLinkProps extends Omit<
  SecondaryNavigationItemProps,
  'leadingItems'
> {
  icon: ReactNode;
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
}: SecondaryNavigationReorderableLinkProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const isActive =
    incomingIsActive ?? isPrimaryNavigationLinkActive(activeTo, location.pathname, {end});
  const {layout} = usePrimaryNavigation();
  const {reset: closeCollapsedNavigationHovercard} = useHovercardContext();
  const {isDragging} = useReorderableItemContext();

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
    navigate(to as string, {state: {source: SIDEBAR_NAVIGATION_SOURCE}});
  }

  return (
    <StyledReorderableFakeLink
      role="link"
      tabIndex={0}
      layout={layout}
      aria-current={isActive ? 'page' : undefined}
      aria-selected={isActive}
      onClick={handleNavigate}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNavigate();
        }
      }}
    >
      <Flex justify="center" align="center" position="relative">
        <GrabHandle />
        <Flex justify="center" align="center" data-reorderable-handle-slot>
          {icon}
        </Flex>
      </Flex>
      <Text ellipsis variant={layout === 'sidebar' ? 'muted' : undefined}>
        {children}
      </Text>
      {trailingItems}
    </StyledReorderableFakeLink>
  );
}

function GrabHandle(props: FlexProps<'div'>) {
  const {attributes, isDragging, listeners, setActivatorNodeRef} =
    useReorderableItemContext();
  return (
    <Flex
      {...props}
      data-drag-icon
      ref={setActivatorNodeRef}
      {...listeners}
      {...attributes}
      width="18px"
      height="18px"
      justify="center"
      align="center"
      style={{cursor: isDragging ? 'grabbing' : 'grab'}}
    >
      <IconGrabbable variant="muted" />
    </Flex>
  );
}

interface SecondaryNavigationIndicatorProps {
  variant: 'accent' | 'danger' | 'warning';
}

function SecondaryNavigationIndicator(props: SecondaryNavigationIndicatorProps) {
  return (
    <Container
      position="absolute"
      top="0"
      right="0"
      width="10px"
      height="10px"
      radius="full"
    >
      {p => <DotIndicator {...p} variant={props.variant} />}
    </Container>
  );
}

const DotIndicator = styled('div')<{variant: 'accent' | 'danger' | 'warning'}>`
  background: ${p => p.theme.tokens.graphics[p.variant].vibrant};
  border: 2px solid ${p => p.theme.tokens.border[p.variant].muted};
`;

interface NavigationFakeLinkProps {
  layout: 'mobile' | 'sidebar';
}

const NavigationFakeLink = styled('div')<NavigationFakeLinkProps>`
  display: flex;
  gap: ${p => p.theme.space.sm};
  justify-content: center;
  align-items: center;
  position: relative;
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  padding: ${p =>
    p.layout === 'mobile'
      ? `${p.theme.space.sm} ${p.theme.space.lg} ${p.theme.space.sm} ${p.theme.space.lg}`
      : `${p.theme.space.md} ${p.theme.space.lg}`};
  border-radius: ${p => p.theme.radius[p.layout === 'mobile' ? '0' : 'md']};
  cursor: pointer;
  user-select: none;

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
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
  }

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &[aria-selected='true'] {
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

  &:focus-visible {
    outline: ${p => p.theme.focusRing()};
  }
`;

const StyledReorderableFakeLink = styled(NavigationFakeLink)`
  :not(:hover) {
    [data-drag-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }

  :hover {
    [data-reorderable-handle-slot] {
      ${p => p.theme.visuallyHidden}
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
