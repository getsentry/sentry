import type {LinkProps} from '@sentry/scraps/link';

import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {
  hasSecondaryNavigation,
  usePrimaryNavigation,
} from 'sentry/views/navigation/primaryNavigationContext';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

import {isPrimaryNavigationLinkActive} from './components';

/**
 * Returns props for a primary nav item. Clicking an item is the only way to
 * open the secondary sidebar; hovering does nothing.
 */
export function useActivateNavigationGroup() {
  const {layout, features, setActiveGroup, activeGroup, routeGroup} =
    usePrimaryNavigation();
  const {setView} = useSecondaryNavigation();
  const location = useLocation();

  return function makeNavigationItemProps(
    group: ReturnType<typeof usePrimaryNavigation>['activeGroup'],
    to: string,
    activeTo?: string | string[]
  ): Omit<Partial<LinkProps>, 'to'> {
    const activePaths = Array.isArray(activeTo) ? activeTo : [activeTo ?? to];
    // A standalone group's route can live under another item's path (the
    // Issues inbox lives under /issues/), so only that group is active there.
    const isActive =
      (hasSecondaryNavigation(routeGroup) || routeGroup === group) &&
      activePaths.some(path =>
        isPrimaryNavigationLinkActive(normalizeUrl(path), location.pathname)
      );

    const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!hasSecondaryNavigation(group)) {
        // Nothing to drill into, so just navigate. On mobile this also closes
        // the menu, since MobileNavigation closes when view is 'collapsed'.
        if (layout === 'mobile') {
          setView('collapsed');
        }
        setActiveGroup(null);
        return;
      }

      // On touch mobile devices, activate the group without navigating.
      if (layout === 'mobile' && !features.hover) {
        e.preventDefault();
      }
      setActiveGroup(group);
      setView('expanded');
    };

    return {
      'aria-current': isActive ? ('location' as const) : undefined,
      'data-active-group': activeGroup === group ? 'true' : undefined,
      onClick,
    };
  };
}
