import type {LocationDescriptor} from 'history';

import type {FeatureProps} from 'sentry/components/acl/feature';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/components/sidebar/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

/**
 * NavItem is the base class for both SidebarItem and SubmenuItem
 */
interface NavItem {
  /**
   * User-facing item label, surfaced in the UI. Should be translated!
   */
  label: string;
  /**
   * Optionally, props which should be passed to a wrapping `<Feature>` guard
   */
  feature?: FeatureProps;
}

/**
 * NavItems are displayed in either `main` and `footer` sections
 */
export interface NavItemLayout<Item extends NavSidebarItem | NavSubmenuItem> {
  main: Item[];
  footer?: Item[];
}

/**
 * SidebarItem is a top-level NavItem which is always displayed in the app sidebar
 */
export interface NavSidebarItem extends NavItem {
  /**
   * A unique identifier string, used as a key for analytics
   */
  analyticsKey: string;
  /**
   * The icon to render in the sidebar
   */
  icon: React.ReactElement;
  /**
   * dropdown menu to display when this SidebarItem is clicked
   */
  dropdown?: MenuItemProps[];
  /**
   * Optionally, the submenu items to display when this SidebarItem is active
   */
  submenu?: NavSubmenuItem[] | NavItemLayout<NavSubmenuItem>;
  /**
   * The pathname (including `search` params) to navigate to when the item is clicked.
   * Defaults to the `to` property of the first `SubmenuItem` if excluded.
   */
  to?: string;
}

/**
 * SubmenuItem is a secondary NavItem which is only displayed when its parent SidebarItem is active
 */
export interface NavSubmenuItem extends NavItem {
  /**
   * The pathname (including `search` params) to navigate to when the item is clicked.
   */
  to: string;
}

export type NavConfig = NavItemLayout<NavSidebarItem>;

export type NavigationItemStatus = 'inactive' | 'active' | 'active-parent';

export function isLinkActive(to: string, pathname: string): boolean {
  const normalizedTo = normalizeUrl(to);
  const normalizedCurrent = normalizeUrl(pathname);

  return normalizedCurrent.startsWith(normalizedTo);
}

/**
 * Creates a `LocationDescriptor` from a URL string that may contain search params
 */
export function makeLinkPropsFromTo(to: string): {
  state: object;
  to: LocationDescriptor;
} {
  const {pathname, search, hash} = new URL(
    to,
    // For partial URLs (pathname + hash? + params?), we use a
    // placeholder base URL to create a parseable URL string.
    // Note that both the URL scheme and domain are discarded.
    !to.startsWith('http') ? 'https://sentry.io/' : undefined
  );

  return {
    to: normalizeUrl({
      pathname,
      search,
      hash,
    }),
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
  };
}

export function isNonEmptyArray(item: unknown): item is any[] {
  return Array.isArray(item) && item.length > 0;
}
