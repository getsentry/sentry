import {createContext, useContext, useMemo, useState} from 'react';

import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/components/nav/constants';
import {NavLayout, type PrimaryNavGroup} from 'sentry/components/nav/types';
import {useBreakpoints} from 'sentry/utils/metrics/useBreakpoints';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export interface NavContext {
  activeGroup: PrimaryNavGroup | null;
  isCollapsed: boolean;
  layout: NavLayout;
  secondaryNavEl: HTMLElement | null;
  setActiveGroup: (group: PrimaryNavGroup | null) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  setSecondaryNavEl: (el: HTMLElement | null) => void;
}

const NavContext = createContext<NavContext>({
  secondaryNavEl: null,
  setSecondaryNavEl: () => {},
  layout: NavLayout.SIDEBAR,
  isCollapsed: false,
  setIsCollapsed: () => {},
  activeGroup: null,
  setActiveGroup: () => {},
});

export function useNavContext(): NavContext {
  return useContext(NavContext);
}

export function NavContextProvider({children}: {children: React.ReactNode}) {
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [secondaryNavEl, setSecondaryNavEl] = useState<HTMLElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<PrimaryNavGroup | null>(null);
  const screen = useBreakpoints();

  const value = useMemo(
    () => ({
      secondaryNavEl,
      setSecondaryNavEl,
      layout: screen.medium ? NavLayout.SIDEBAR : NavLayout.MOBILE,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      setActiveGroup,
    }),
    [
      screen.medium,
      secondaryNavEl,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      setActiveGroup,
    ]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
