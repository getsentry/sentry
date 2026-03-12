import {useRef} from 'react';

import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {useMouseMovement} from 'sentry/views/navigation/primary/useMouseMovement';
import {useWindowHeight} from 'sentry/views/navigation/primary/useWindowHeight';
import {NavigationLayout, PrimaryNavigationGroup} from 'sentry/views/navigation/types';

/**
 * Hovering over a primary nav item will change the contents of the sidebar.
 * This hook returns event handlers which can be applied to a nav item.
 *
 * When a nav item detects a mouse enter event, it will either activate the group
 * immediately, or do so after a short delay depending on mouse position and angle of movement.
 *
 * There are two cases where we add a delay:
 *
 * 1. If it looks like the user is moving their mouse towards the secondary sidebar content,
 *    an extra delay is added to prevent other nav groups from being activated.
 * 2. If it looks like the user is skimming the side of the nav (e.g. they are browsing the secondary
 *    nav), an extra delay is added to prevent accidental activation.
 */
export function useActivateNavigationGroupOnHover({
  ref,
}: {
  ref: React.RefObject<HTMLElement | null>;
}) {
  const {layout} = useNavigationContext();
  const mouseAccelerationRef = useMouseMovement({
    ref,
    disabled: layout !== NavigationLayout.SIDEBAR,
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {setActivePrimaryNavigationGroup, isCollapsed, collapsedNavigationIsOpen} =
    useNavigationContext();
  const windowHeight = useWindowHeight();

  return function makeNavigationItemProps(group: PrimaryNavigationGroup) {
    const onMouseEnter = (e: MouseEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (isCollapsed && !collapsedNavigationIsOpen) {
        setActivePrimaryNavigationGroup(group);
        return;
      }

      const getDelay = () => {
        const {horizontalSpeed, verticalSpeed, horizontalDirection, verticalDirection} =
          mouseAccelerationRef.current;

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const distanceToRightEdge = PRIMARY_SIDEBAR_WIDTH - mouseX;
        const distanceToTop = mouseY;
        const distanceToBottom = windowHeight - mouseY;

        // Find angle from mouse to top and bottom of nav
        // This is the angle of motion that likely inidcates that the user is
        // moving their mouse into the secondary nav.
        // Similar to https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown
        const angleToTop =
          Math.atan2(distanceToTop, distanceToRightEdge) * (180 / Math.PI);
        const angleToBottom =
          Math.atan2(distanceToBottom, distanceToRightEdge) * (180 / Math.PI);

        const mouseDirectionAngle =
          horizontalSpeed === 0
            ? 90
            : Math.atan2(verticalSpeed, horizontalSpeed) * (180 / Math.PI);

        const isMovingTowardSecondaryNavigation =
          horizontalDirection > 0
            ? verticalDirection > 0
              ? mouseDirectionAngle < angleToBottom
              : mouseDirectionAngle < angleToTop
            : false;

        const isSkimmingRightSide =
          horizontalDirection < 1 && mouseX > PRIMARY_SIDEBAR_WIDTH * 0.8;

        // If we deem the user intention is _not_ to active another nav group, add a 200ms delay
        if (isMovingTowardSecondaryNavigation || isSkimmingRightSide) {
          return 200;
        }

        // Otherwise, activate immediately
        return 0;
      };

      timeoutRef.current = setTimeout(() => {
        setActivePrimaryNavigationGroup(group);
      }, getDelay());
    };

    const onMouseLeave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };

    const onClick = () => {
      setActivePrimaryNavigationGroup(group);
    };

    return {
      onMouseEnter,
      onMouseLeave,
      onClick,
    };
  };
}
