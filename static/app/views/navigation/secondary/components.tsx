import {useRef, type ReactNode} from 'react';
import type {To} from 'react-router-dom';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import {AnimatePresence, motion} from 'framer-motion';
import PlatformIcon from 'platformicons/build/platformIcon';

import {Button} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {useHovercardContext} from 'sentry/components/hovercard';
import {IconAllProjects, IconChevron, IconMyProjects} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {testableTransition} from 'sentry/utils/testableTransition';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useResizable} from 'sentry/utils/useResizable';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE,
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
} from 'sentry/views/navigation/navigationTour';
import {isPrimaryNavigationLinkActive} from 'sentry/views/navigation/primary/components';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

interface SecondarySidebarProps {
  children: ReactNode;
}

function SecondarySidebar({children}: SecondarySidebarProps) {
  const {currentStepId} = useNavigationTour();
  const stepId = currentStepId ?? NavigationTour.ISSUES;
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const [secondarySidebarWidth, setSecondarySidebarWidth] = useSyncedLocalStorageState(
    'secondary-sidebar-width',
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
        <ResizeWrapper
          {...props}
          ref={mergeRefs(resizableContainerRef, ref)}
          {...{
            [NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE]: true,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <MotionDiv
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
              <ResizeHandle
                ref={resizeHandleRef}
                onMouseDown={handleStartResize}
                onDoubleClick={() => {
                  setSecondarySidebarWidth(SECONDARY_SIDEBAR_WIDTH);
                }}
                atMinWidth={size === SECONDARY_SIDEBAR_MIN_WIDTH}
                atMaxWidth={size === SECONDARY_SIDEBAR_MAX_WIDTH}
              />
            </MotionDiv>
          </AnimatePresence>
        </ResizeWrapper>
      )}
    </SecondarySidebarWrapper>
  );
}

const SecondarySidebarWrapper = styled(NavigationTourElement)`
  background: ${p => p.theme.tokens.background.secondary};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  position: relative;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  height: 100%;
`;

const ResizeWrapper = styled('div')`
  right: 0;
  height: 100%;
  width: ${SECONDARY_SIDEBAR_WIDTH}px;
`;

const MotionDiv = styled(motion.div)`
  height: 100%;
  width: 100%;
`;

const ResizeHandle = styled('div')<{atMaxWidth: boolean; atMinWidth: boolean}>`
  position: absolute;
  right: 0px;
  top: 0;
  bottom: 0;
  width: 8px;
  border-radius: 8px;
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
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  title: ReactNode;
  trailingItems?: ReactNode;
}

function SectionTitle(props: SectionTitleProps) {
  const {layout} = usePrimaryNavigation();

  if (props.canCollapse) {
    return (
      <SectionTitleCollapsible
        size="sm"
        priority="transparent"
        isMobile={layout === 'mobile'}
        onClick={() => {
          props.setIsCollapsed(!props.isCollapsed);
        }}
        isCollapsed={props.isCollapsed}
      >
        <SectionTitleLabelWrap>{props.title}</SectionTitleLabelWrap>
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
      </SectionTitleCollapsible>
    );
  }

  return (
    <SectionTitleUnCollapsible isMobile={layout === 'mobile'}>
      {props.title}
      {props.trailingItems}
    </SectionTitleUnCollapsible>
  );
}

interface SecondaryNavigationSectionProps {
  children: ReactNode;
  id: string;
  className?: string;
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
    <Section className={props.className} layout={layout} data-nav-section>
      {props.title ? (
        <SectionTitle
          title={props.title}
          trailingItems={props.trailingItems}
          canCollapse={canCollapse}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsedState}
        />
      ) : null}
      <Collapsible collapsed={isCollapsed} disabled={!canCollapse}>
        {props.children}
      </Collapsible>
    </Section>
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
  showInteractionStateLayer = true,
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
      state={{source: SIDEBAR_NAVIGATION_SOURCE}}
      {...linkProps}
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
      {showInteractionStateLayer && (
        <InteractionStateLayer data-isl hasSelectedBackground={isActive} />
      )}
      <Text ellipsis variant={layout === 'sidebar' ? 'muted' : undefined}>
        {children}
      </Text>
      {trailingItems}
    </NavigationLink>
  );
}

interface SecondaryNavigationFooterProps {
  children: ReactNode;
}

function SecondaryNavigationFooter(props: SecondaryNavigationFooterProps) {
  const {layout} = usePrimaryNavigation();
  return <Footer layout={layout}>{props.children}</Footer>;
}

function SecondaryNavigationSeparator() {
  return (
    <Container padding="md xl">
      <Separator orientation="horizontal" border="muted" />
    </Container>
  );
}

interface SecondaryNavigationProjectIconProps {
  projectPlatforms: string[];
  allProjects?: boolean;
}

function SecondaryNavigationProjectIcon(props: SecondaryNavigationProjectIconProps) {
  let renderedIcons: React.ReactNode;

  switch (props.projectPlatforms.length) {
    case 0:
      renderedIcons = props.allProjects ? (
        <IconAllProjects size="md" />
      ) : (
        <IconMyProjects size="md" />
      );
      break;
    case 1:
      renderedIcons = (
        <IconContainer>
          <StyledPlatformIcon platform={props.projectPlatforms[0]!} size={18} />
          <BorderOverlay />
        </IconContainer>
      );
      break;
    default:
      renderedIcons = (
        <IconContainer>
          {props.projectPlatforms.slice(0, 2).map((platform, index) => (
            <PlatformIconWrapper key={platform} index={index}>
              <StyledPlatformIcon platform={platform} size={14} />
              <BorderOverlay />
            </PlatformIconWrapper>
          ))}
        </IconContainer>
      );
  }

  return (
    <Stack justify="center" align="center" flexShrink={0} data-project-icon>
      {renderedIcons}
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
        <CollapsibleWrapper
          key="collapsible-content"
          variants={{
            collapsed: {
              height: 0,
              overflow: 'hidden',
            },
            expanded: {
              // overflow: 'visible',
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
        </CollapsibleWrapper>
      )}
    </AnimatePresence>
  );
}

const CollapsibleWrapper = styled(motion.div)`
  display: flex;
  /*
    This column-reverse is what creates the "folder" animation effect, where children "fall out" of the header
    when un-collapsed, and are "sucked in" to the header when collapsed, rather than a standard accordion effect.
  */
  flex-direction: column-reverse;
  margin: 0;
`;

const IconContainer = styled('div')`
  position: relative;
  display: grid;
  width: 18px;
  height: 18px;
`;

const BorderOverlay = styled('div')`
  position: absolute;
  inset: 0;
  border: 1px solid ${p => p.theme.colors.gray100};
  border-radius: 3px;
  pointer-events: none;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  display: block;
`;

const PlatformIconWrapper = styled('div')<{index: number}>`
  position: absolute;
  width: 14px;
  height: 14px;
  ${p =>
    p.index === 0 &&
    css`
      top: 0;
      left: 0;
    `}
  ${p =>
    p.index === 1 &&
    css`
      bottom: 0;
      right: 0;
    `}
`;

const Section = styled('div')<{layout: 'mobile' | 'sidebar'}>`
  ${p =>
    p.layout === 'sidebar' &&
    css`
      padding: 0 ${p.theme.space.sm};
    `}

  &:first-child {
    padding-top: ${p => p.theme.space.md};
  }

  &:last-child {
    padding-bottom: ${p => p.theme.space.md};
  }
`;

const sectionTitleStyles = (p: {isMobile: boolean; theme: Theme}) => css`
  font-weight: ${p.theme.font.weight.sans.medium};
  color: ${p.theme.tokens.content.primary};
  padding: ${p.theme.space.sm} ${p.theme.space.lg};
  width: 100%;
  ${p.isMobile &&
  css`
    padding: ${p.theme.space.md} ${p.theme.space.lg} ${p.theme.space.md} 48px;
  `}
`;

const SectionTitleUnCollapsible = styled('div')<{isMobile: boolean}>`
  ${sectionTitleStyles}
  display: flex;
  justify-content: space-between;
`;

const SectionTitleCollapsible = styled(Button, {
  shouldForwardProp: (prop: string) => !['isMobile', 'isCollapsed'].includes(prop),
})<{isCollapsed: boolean; isMobile: boolean}>`
  ${sectionTitleStyles}
  display: flex;
  justify-content: space-between;
  font-size: ${p => p.theme.font.size.md};

  & > span:last-child {
    flex: 1;
    justify-content: space-between;
    white-space: nowrap;
  }
`;

const SectionTitleLabelWrap = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
`;

interface SidebarLink extends LinkProps {
  layout: 'mobile' | 'sidebar';
}

const NavigationLink = styled(Link)<SidebarLink>`
  display: flex;
  gap: ${p => p.theme.space.sm};
  justify-content: center;
  align-items: center;
  position: relative;
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  padding: ${p =>
    p.layout === 'mobile'
      ? `${p.theme.space.sm} ${p.theme.space.lg} ${p.theme.space.sm} 48px`
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

const Footer = styled('div')<{layout: 'mobile' | 'sidebar'}>`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};

  ${p =>
    p.layout === 'mobile' &&
    css`
      padding: ${p.theme.space.md} 0;
    `}
`;

export const SecondaryNavigation = {
  Header: SecondaryNavigationHeader,
  Body: SecondaryNavigationBody,
  Section: SecondaryNavigationSection,
  Separator: SecondaryNavigationSeparator,
  List: SecondaryNavigationList,
  ListItem: SecondaryNavigationListItem,
  Link: SecondaryNavigationLink,
  Footer: SecondaryNavigationFooter,
  ProjectIcon: SecondaryNavigationProjectIcon,
  Sidebar: SecondarySidebar,
};
