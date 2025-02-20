import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useInteractOutside} from '@react-aria/interactions';

import {useNavContext} from 'sentry/components/nav/context';
import MobileTopbar from 'sentry/components/nav/mobileTopbar';
import {Sidebar} from 'sentry/components/nav/sidebar';
import {NavLayout} from 'sentry/components/nav/types';

function useHoverWithin({isDisabled}: {isDisabled?: boolean}) {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Resets hover state if nav is disabled
  // Without this the menu will pop back open when collapsing
  if (isDisabled && isHovered) {
    setIsHovered(false);
  }

  // Sets up event listeners for opening/closing the nav
  // Mouse in -> open
  // Mouse out -> close
  // Focus on elements within nav -> open
  // Focus on elements outside nav -> close
  // Escape -> close
  useEffect(() => {
    const element = ref.current;
    if (!element || isDisabled) {
      return () => {};
    }

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => {
      if (!ref.current?.contains(document.activeElement as Node)) {
        setIsHovered(false);
      }
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    const handleFocus = (e: FocusEvent) => {
      if (ref.current?.contains(e.target as Node)) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHovered(false);
      }
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('focusin', handleFocus);
    };
  }, [isDisabled]);

  // Handles clicks outside the nav container
  // Most of the the nav will already be closed by mouse or focus events,
  // but this will catch instances where clicks on non-focusable elements
  useInteractOutside({
    ref,
    onInteractOutside: () => setIsHovered(false),
    isDisabled,
  });

  return {ref, isHovered};
}

function Nav() {
  const {layout, isCollapsed} = useNavContext();

  const {isHovered, ref} = useHoverWithin({
    isDisabled: layout !== NavLayout.SIDEBAR || !isCollapsed,
  });

  return (
    <NavContainer ref={ref}>
      {layout === NavLayout.SIDEBAR ? (
        <Sidebar isHovered={isHovered} />
      ) : (
        <MobileTopbar />
      )}
    </NavContainer>
  );
}

const NavContainer = styled('div')`
  display: flex;
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  user-select: none;

  @media screen and (min-width: ${p => p.theme.breakpoints.medium}) {
    bottom: 0;
    height: 100vh;
    height: 100dvh;
  }
`;

export default Nav;
