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

export interface DeprecatedNavContext {
  /** Raw config for entire nav items */
  config: Readonly<NavConfig>;
  /** Currently active submenu items, if any */
  submenu?: Readonly<NavItemLayout<NavSubmenuItem>>;
}

const DeprecatedNavContext = createContext<DeprecatedNavContext>({config: {main: []}});

export function useNavContextDeprecated(): DeprecatedNavContext {
  const navContext = useContext(DeprecatedNavContext);
  return navContext;
}

export function DeprecatedNavContextProvider({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const location = useLocation();
  /** Raw nav configuration values */
  const config = useMemo(() => createNavConfig({organization}), [organization]);
  /**
   * Active submenu items derived from the nav config and current `location`.
   * These are returned in a normalized layout format for ease of use.
   */
  const submenu = useMemo<DeprecatedNavContext['submenu']>(() => {
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

  return (
    <DeprecatedNavContext.Provider value={{config, submenu}}>
      {children}
    </DeprecatedNavContext.Provider>
  );
}

const normalizeSubmenu = (
  submenu: NavSidebarItem['submenu']
): DeprecatedNavContext['submenu'] => {
  if (Array.isArray(submenu)) {
    return {main: submenu};
  }
  return submenu;
};
