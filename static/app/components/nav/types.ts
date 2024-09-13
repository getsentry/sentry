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
