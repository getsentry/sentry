import {createContext, useContext, useEffect, useState} from 'react';

import {createNavConfig} from 'sentry/components/nav/config';
import type {NavConfig, NavMenuKey} from 'sentry/components/nav/utils';
import {useActiveNavIds} from 'sentry/components/nav/utils';
import useOrganization from 'sentry/utils/useOrganization';

interface NavContext {
  /**
   * key for the active primary navigation menu
   */
  activeMenuId: NavMenuKey;
  /**
   * key for the active secondary navigation menu, if applicable
   */
  activeSubmenuId: string | undefined;
  config: NavConfig;
  setActiveMenuId: React.Dispatch<React.SetStateAction<NavMenuKey>>;
  setActiveSubmenuId: React.Dispatch<React.SetStateAction<string | undefined>>;
}

const NavContext = createContext<NavContext>({} as any);

export function NavContextProvider({children}) {
  const organization = useOrganization();
  const config = createNavConfig({organization});
  const defaultActiveIds = useActiveNavIds();
  const [activeMenuId, setActiveMenuId] = useState<NavMenuKey>(defaultActiveIds.menu);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | undefined>(
    defaultActiveIds.submenu
  );

  return (
    <NavContext.Provider
      value={{
        config,
        activeMenuId,
        setActiveMenuId,
        activeSubmenuId,
        setActiveSubmenuId,
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export function useNavContext() {
  return useContext(NavContext);
}

export function useNavSidebar(main: NavMenuKey, initialSubmenu?: string) {
  const {setActiveMenuId, setActiveSubmenuId} = useNavContext();
  useEffect(() => {
    setActiveMenuId(main);
  }, [setActiveMenuId, main]);
  useEffect(() => {
    setActiveSubmenuId(active => (active ? active : initialSubmenu));
  }, [setActiveSubmenuId, initialSubmenu]);
}
