import {createContext, useContext, useMemo} from 'react';

import {createNavConfig} from 'sentry/components/nav/config';
import type {
  NavConfig,
  NavItemLayout,
  NavSidebarItem,
  NavSubmenuItem,
} from 'sentry/components/nav/utils';
import {isNavItemActive, isSubmenuItemActive} from 'sentry/components/nav/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export interface NavContext {
  /** Raw config for entire nav items */
  config: Readonly<NavConfig>;
  /** Currently active submenu items, if any */
  submenu?: Readonly<NavItemLayout<NavSubmenuItem>>;
}

const NavContext = createContext<NavContext>({config: {main: []}});

export function useNavContext(): NavContext {
  const navContext = useContext(NavContext);
  return navContext;
}

export function NavContextProvider({children}: any) {
  const organization = useOrganization();
  const location = useLocation();
  /** Raw nav configuration values */
  const config = useMemo(() => createNavConfig({organization}), [organization]);
  /**
   * Active submenu items derived from the nav config and current `location`.
   * These are returned in a normalized layout format for ease of use.
   */
  const submenu = useMemo<NavContext['submenu']>(() => {
    for (const item of config.main) {
      if (isNavItemActive(item, location) || isSubmenuItemActive(item, location)) {
        return normalizeSubmenu(item.submenu);
      }
    }
    if (config.footer) {
      for (const item of config.footer) {
        if (isNavItemActive(item, location) || isSubmenuItemActive(item, location)) {
          return normalizeSubmenu(item.submenu);
        }
      }
    }
    return undefined;
  }, [config, location]);

  return <NavContext.Provider value={{config, submenu}}>{children}</NavContext.Provider>;
}

const normalizeSubmenu = (submenu: NavSidebarItem['submenu']): NavContext['submenu'] => {
  if (Array.isArray(submenu)) {
    return {main: submenu};
  }
  return submenu;
};
