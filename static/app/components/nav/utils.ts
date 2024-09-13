import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {useLocation} from 'sentry/utils/useLocation';

export const NAV_DIVIDER = Symbol('divider');

export interface SidebarItem {
  icon: JSX.Element;
  label: string;
  to: string;
  submenu?: (SubmenuItem | typeof NAV_DIVIDER)[];
}
export interface SubmenuItem {
  label: string;
  to: string;
}

export type NavItems = Array<SidebarItem | typeof NAV_DIVIDER>;

export function isActive(
  item: SidebarItem | SubmenuItem,
  location: ReturnType<typeof useLocation>
): boolean {
  const normalizedTo = normalizeUrl(item.to);
  const normalizedCurrent = normalizeUrl(location.pathname);
  if (normalizedTo === normalizedCurrent) return true;
  if (normalizedCurrent.startsWith(normalizedTo)) return true;
  if (
    'submenu' in item &&
    item.submenu?.find(
      subitem => typeof subitem === 'object' && isActive(subitem, location)
    ) !== undefined
  ) {
    return true;
  }
  return false;
}

export function splitAtDivider<T>(arr: (T | typeof NAV_DIVIDER)[]): [T[], T[]] {
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
  return [body, footer];
}
