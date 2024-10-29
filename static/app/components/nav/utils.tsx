import type {ComponentProps} from 'react';
import type {LocationDescriptor} from 'history';

import type Feature from 'sentry/components/acl/feature';
import {isItemActive} from 'sentry/components/sidebar/sidebarItem';
import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/components/sidebar/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {useLocation} from 'sentry/utils/useLocation';

/** NavItem is the base class for both SidebarItem and SubmenuItem  */
interface NavItem {
  /** User-facing item label, surfaced in the UI. Should be translated! */
  label: string;
  /** Optionally, props which should be passed to a wrapping `<Feature>` guard */
  feature?: Omit<ComponentProps<typeof Feature>, 'children'>;
}

/** NavItems are displayed in either `main` and `footer` sections */
export interface NavItemLayout<Item extends NavSidebarItem | NavSubmenuItem> {
  main: Item[];
  footer?: Item[];
}

/** SidebarItem is a top-level NavItem which is always displayed in the app sidebar */
export interface NavSidebarItem extends NavItem {
  /** The icon to render in the sidebar */
  icon: JSX.Element;
  /** Optionally, the submenu items to display when this SidebarItem is active */
  submenu?: NavSubmenuItem[] | NavItemLayout<NavSubmenuItem>;
  /**
   * The pathname (including `search` params) to navigate to when the item is clicked.
   * Defaults to the `to` property of the first `SubmenuItem` if excluded.
   */
  to?: string;
}

/** SubmenuItem is a secondary NavItem which is only displayed when its parent SidebarItem is active */
export interface NavSubmenuItem extends NavItem {
  /**
   * The pathname (including `search` params) to navigate to when the item is clicked.
   */
  to: string;
}

export type NavConfig = NavItemLayout<NavSidebarItem>;

export type NavigationItemStatus = 'inactive' | 'active' | 'active-parent';

/** Determine if a given SidebarItem or SubmenuItem is active */
export function isNavItemActive(
  item: NavSidebarItem | NavSubmenuItem,
  location: ReturnType<typeof useLocation>
): boolean {
  const to = resolveNavItemTo(item);
  if (!to) {
    return false;
  }

  /**
   * Issue submenu is special cased because it is matched based on query params
   * rather than the pathname.
   */
  if (location.pathname.includes('/issues/') && to.includes('/issues/')) {
    const {label} = item;
    const matches = hasMatchingQueryParam({to, label}, location);
    const isDefault = label === 'All';
    if (location.search) {
      return matches || isDefault;
    }
    return isDefault;
  }

  const normalizedTo = normalizeUrl(to);
  const normalizedCurrent = normalizeUrl(location.pathname);
  // Shortcut for exact matches
  if (normalizedTo === normalizedCurrent) {
    return true;
  }
  // Fallback to legacy nav logic
  return isItemActive({to, label: item.label});
}

export function isSubmenuItemActive(
  item: NavSidebarItem,
  location: ReturnType<typeof useLocation>
): boolean {
  if (!item.submenu) {
    return false;
  }
  if (isNonEmptyArray(item.submenu)) {
    return item.submenu.some(subitem => isNavItemActive(subitem, location));
  }
  return (
    item.submenu.main.some(subitem => isNavItemActive(subitem, location)) ||
    item.submenu.footer?.some(subitem => isNavItemActive(subitem, location)) ||
    false
  );
}

/** Creates a `LocationDescriptor` from a URL string that may contain search params */
export function makeLinkPropsFromTo(to: string): {
  state: object;
  to: LocationDescriptor;
} {
  const [pathname, search] = to.split('?');

  return {
    to: {
      pathname,
      search: search ? `?${search}` : undefined,
    },
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
  };
}

export function isNonEmptyArray(item: unknown): item is any[] {
  return Array.isArray(item) && item.length > 0;
}

/** SidebarItem `to` can be derived from the first submenu item if necessary */
export function resolveNavItemTo(
  item: NavSidebarItem | NavSubmenuItem
): string | undefined {
  if (item.to) {
    return item.to;
  }
  if (isSidebarItem(item) && isNonEmptyArray(item.submenu)) {
    return item.submenu[0].to;
  }
  return undefined;
}

/**
 * Unique logic for query param matches.
 *
 * `location` might have additional query params,
 * but it considered active if it contains *all* of the params in `item`.
 */
function hasMatchingQueryParam(
  item: Required<Pick<NavSidebarItem | NavSubmenuItem, 'to' | 'label'>>,
  location: ReturnType<typeof useLocation>
): boolean {
  if (location.search.length === 0) {
    return false;
  }
  if (item.to.includes('?')) {
    const search = new URLSearchParams(location.search);
    const itemSearch = new URLSearchParams(item.to.split('?').at(-1));
    const itemQuery = itemSearch.get('query');
    const query = search.get('query');
    /**
     * The "Issues / All" tab is a special case!
     * It is considered active if no other queries are.
     */
    if (item?.label === 'All') {
      return !query && !itemQuery;
    }
    if (itemQuery && query) {
      let match = false;
      for (const key of itemQuery?.split(' ')) {
        match = query.includes(key);
        if (!match) {
          continue;
        }
      }
      return match;
    }
  }
  return false;
}

function isSidebarItem(item: NavSidebarItem | NavSubmenuItem): item is NavSidebarItem {
  return Object.hasOwn(item, 'icon');
}
