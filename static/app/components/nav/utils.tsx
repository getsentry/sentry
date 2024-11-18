import type {LocationDescriptor} from 'history';

import type {FeatureProps} from 'sentry/components/acl/feature';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/components/sidebar/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

export type NavMenuKey =
  | 'issues'
  | 'projects'
  | 'explore'
  | 'insights'
  | 'performance'
  | 'boards'
  | 'alerts'
  | 'settings'
  | 'help';

// TODO(nate.moore): these should be derived from the route data, not hardcoded
export function useActiveNavIds(): {menu: NavMenuKey; submenu?: string} {
  const {pathname} = useLocation();

  if (pathname.includes('/issues/')) {
    const after = pathname.split('/issues/').at(-1)?.trim();
    return {menu: 'issues', submenu: after ? undefined : 'all'};
  }
  if (pathname.includes('/feedback/')) {
    return {menu: 'issues', submenu: 'feedback'};
  }
  if (pathname.includes('/projects/')) {
    return {menu: 'projects'};
  }
  if (pathname.includes('/insights/')) {
    const domain = pathname.split('/').at(-1);
    return {menu: 'performance', submenu: domain};
  }
  if (pathname.includes('/dashboard/')) {
    return {menu: 'boards'};
  }
  if (pathname.includes('/settings/')) {
    return {menu: 'settings'};
  }
  if (pathname.includes('/alerts/')) {
    return {menu: 'alerts'};
  }

  if (pathname.includes('/traces/')) {
    return {menu: 'explore', submenu: 'insights'};
  }
  if (pathname.includes('/metrics/')) {
    return {menu: 'explore', submenu: 'metrics'};
  }
  if (pathname.includes('/profiling/')) {
    return {menu: 'explore', submenu: 'profiling'};
  }
  if (pathname.includes('/replays/')) {
    return {menu: 'explore', submenu: 'replays'};
  }
  if (pathname.includes('/discover/')) {
    return {menu: 'explore', submenu: 'discover'};
  }
  if (pathname.includes('/releases/')) {
    return {menu: 'explore', submenu: 'releases'};
  }
  if (pathname.includes('/crons/')) {
    return {menu: 'explore', submenu: 'crons'};
  }

  return {menu: 'issues', submenu: 'all'};
}

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
   * The icon to render in the sidebar
   */
  icon: React.ReactElement;
  /**
   * A unique key for this menu
   */
  id: NavMenuKey;
  /**
   * dropdown menu to display when this SidebarItem is clicked
   */
  dropdown?: MenuItemProps[];
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
