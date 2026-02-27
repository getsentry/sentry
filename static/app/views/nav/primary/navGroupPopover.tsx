import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {
  NAV_SECONDARY_SIDEBAR_DATA_ATTRIBUTE,
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {SecondaryNavContent} from 'sentry/views/nav/secondary/secondaryNavContent';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

/**
 * A Slack-like floating popover that appears to the right of the primary
 * sidebar when hovering over a non-active nav group icon.
 *
 * The secondary sidebar stays locked to the currently active route's content
 * while this popover provides a non-jarring preview of other sections.
 */
export function NavGroupPopover() {
  const {hoveredNav, setHoveredNav, hoveredNavCloseTimerRef, isCollapsed} =
    useNavContext();
  const activeNavGroup = useActiveNavGroup();

  const handleMouseEnter = () => {
    // Cancel any pending close so the popover stays open when
    // the mouse moves from the nav item to the popover
    if (hoveredNavCloseTimerRef.current) {
      clearTimeout(hoveredNavCloseTimerRef.current);
      hoveredNavCloseTimerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    hoveredNavCloseTimerRef.current = setTimeout(() => {
      setHoveredNav(null);
    }, 150);
  };

  // Don't show when collapsed (collapsed nav has its own flyout behavior)
  // Don't show for the currently active group (secondary sidebar already shows it)
  const shouldShow =
    !isCollapsed && hoveredNav !== null && hoveredNav.group !== activeNavGroup;

  return (
    <AnimatePresence>
      {shouldShow ? (
        <PopoverWrapper
          key={hoveredNav.group}
          style={{
            top: hoveredNav.anchorY,
            maxHeight: `calc(100vh - ${hoveredNav.anchorY}px - 32px)`,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          initial={{opacity: 0, x: -4}}
          animate={{opacity: 1, x: 0}}
          exit={{opacity: 0, x: -4}}
          transition={{duration: 0.1}}
          {...{[NAV_SECONDARY_SIDEBAR_DATA_ATTRIBUTE]: true}}
        >
          <PopoverSecondaryNav>
            <SecondaryNavContent group={hoveredNav.group} />
          </PopoverSecondaryNav>
        </PopoverWrapper>
      ) : null}
    </AnimatePresence>
  );
}

const PopoverSecondaryNav = styled(SecondaryNav)`
  /* Hide the sidebar collapse/expand toggle button - it doesn't apply in popover context */
  [data-secondary-nav-header] > div:last-child {
    display: none;
  }

  /* Let the popover container handle scrolling rather than the inner body */
  [data-secondary-nav-body] {
    overflow: visible;
  }

  /* Sections (e.g. sticky Configure/Alerts) must match the popover background, not the sidebar's */
  [data-secondary-nav-body] [data-nav-section] {
    background: ${p => p.theme.tokens.background.primary};
  }
`;

const PopoverWrapper = styled(motion.div)`
  position: fixed;
  left: ${PRIMARY_SIDEBAR_WIDTH}px;
  width: ${SECONDARY_SIDEBAR_WIDTH}px;
  overflow-y: auto;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 3px 0 0 ${p => p.theme.tokens.border.primary};
  z-index: ${p => p.theme.zIndex.sidebar};
`;
