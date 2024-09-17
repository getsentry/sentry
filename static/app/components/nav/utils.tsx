import {type HTMLProps, useMemo} from 'react';
import type {LocationDescriptor} from 'history';

import {isItemActive} from 'sentry/components/sidebar/sidebarItem';
import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/components/sidebar/utils';
import type {FeatureDisabledHooks, WithoutPrefix} from 'sentry/types/hooks';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {useLocation} from 'sentry/utils/useLocation';

export const NAV_DIVIDER = Symbol('divider');

interface FeatureCheck {
  features: string | string[];
  hook?: WithoutPrefix<keyof FeatureDisabledHooks>;
}

interface NavItem {
  label: string;
  check?: FeatureCheck;
}

export interface SidebarItem extends SidebarItemBase {
  to: string;
  submenu?: SubmenuItem[];
}

export interface SidebarItemBase extends NavItem {
  icon: JSX.Element;
}
interface SidebarItemTopLevel extends SidebarItemBase {
  to: string;
  submenu?: never;
}

interface SidebarItemWithChildren extends SidebarItemBase {
  submenu: (SubmenuItem | false)[];
  to?: never;
}

export interface SubmenuItem extends NavItem {
  to: string;
}

export type NavItemRaw =
  | SidebarItemTopLevel
  | SidebarItemWithChildren
  | typeof NAV_DIVIDER
  | undefined
  | false;

export function resolveSidebarItem(
  item: SidebarItemTopLevel | SidebarItemWithChildren
): SidebarItem {
  if (item.submenu) {
    const submenu = item.submenu.filter(subitem => !!subitem) as SubmenuItem[];
    const [{to}] = submenu;
    return {...item, submenu, to};
  }
  return item;
}

export enum ActiveStatus {
  INACTIVE = 'inactive',
  ACTIVE_PARENT = 'active-parent',
  ACTIVE = 'active',
}

export function getActiveStatus(
  item: SidebarItem | SubmenuItem,
  location: ReturnType<typeof useLocation>
): ActiveStatus {
  if (hasMatchingQueryParam({to: item.to, label: item.label}, location))
    return ActiveStatus.ACTIVE;
  const normalizedTo = normalizeUrl(item.to);
  const normalizedCurrent = normalizeUrl(location.pathname);
  if (normalizedTo === normalizedCurrent) return ActiveStatus.ACTIVE;
  if (isItemActive({to: item.to, label: item.label})) return ActiveStatus.ACTIVE;
  if (
    'submenu' in item &&
    item.submenu?.find(
      subitem =>
        typeof subitem === 'object' &&
        getActiveStatus(subitem, location) !== ActiveStatus.INACTIVE
    ) !== undefined
  ) {
    return ActiveStatus.ACTIVE_PARENT;
  }
  return ActiveStatus.INACTIVE;
}

export function getActiveProps(
  status: ActiveStatus
): Partial<Pick<HTMLProps<HTMLElement>, 'className' | 'aria-current'>> {
  switch (status) {
    case ActiveStatus.ACTIVE_PARENT:
      return {className: 'active'};
    case ActiveStatus.ACTIVE:
      return {className: 'active', 'aria-current': 'page'};
    case ActiveStatus.INACTIVE:
    default:
      return {};
  }
}

export function hasMatchingQueryParam(
  item: Pick<SidebarItem | SubmenuItem, 'to' | 'label'>,
  location: ReturnType<typeof useLocation>
): boolean {
  if (location.search.length === 0) return false;
  if (item.to.includes('?')) {
    const search = new URLSearchParams(location.search);
    const itemSearch = new URLSearchParams(item.to.split('?').at(-1));
    const itemQuery = itemSearch.get('query');
    const query = search.get('query');
    if (item?.label === 'All') {
      return !query && !itemQuery;
    }
    if (itemQuery && query) {
      let match = false;
      for (const key of itemQuery?.split(' ')) {
        match = query.includes(key);
        if (!match) break;
      }
      return match;
    }
  }
  return false;
}

export function splitAtDivider<T>(arr: (T | typeof NAV_DIVIDER)[]): {
  body: T[];
  footer: T[];
} {
  const body: T[] = [];
  const footer: T[] = [];
  let current = body;
  for (const item of arr) {
    if (item === NAV_DIVIDER) {
      current = footer;
      continue;
    }
    current.push(item);
  }
  return {body, footer};
}

export function useLocationDescriptor(to?: string): LocationDescriptor {
  return useMemo(() => {
    if (!to) {
      return '#';
    }
    const [pathname, search] = to.split('?');

    return {
      pathname,
      search: search ? `?${search}` : undefined,
      state: {source: SIDEBAR_NAVIGATION_SOURCE},
    };
  }, [to]);
}
