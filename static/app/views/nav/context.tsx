import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';
import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/nav/constants';
import {NavLayout, type PrimaryNavGroup} from 'sentry/views/nav/types';

export interface NavContext {
  activeGroup: PrimaryNavGroup | null;
  endInteraction: () => void;
  isCollapsed: boolean;
  isInteractingRef: React.RefObject<boolean | null>;
  layout: NavLayout;
  navParentRef: React.RefObject<HTMLDivElement | null>;
  secondaryNavEl: HTMLElement | null;
  setActiveGroup: (group: PrimaryNavGroup | null) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  setSecondaryNavEl: (el: HTMLElement | null) => void;
  setShowTourReminder: (showTourReminder: boolean) => void;
  showTourReminder: boolean;
  startInteraction: () => void;
}

const NavContext = createContext<NavContext>({
  navParentRef: {current: null},
  secondaryNavEl: null,
  setSecondaryNavEl: () => {},
  layout: NavLayout.SIDEBAR,
  isCollapsed: false,
  setIsCollapsed: () => {},
  activeGroup: null,
  setActiveGroup: () => {},
  isInteractingRef: {current: false},
  startInteraction: () => {},
  endInteraction: () => {},
  showTourReminder: false,
  setShowTourReminder: () => {},
});

export function useNavContext(): NavContext {
  return useContext(NavContext);
}

export function NavContextProvider({children}: {children: React.ReactNode}) {
  const navParentRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [secondaryNavEl, setSecondaryNavEl] = useState<HTMLElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<PrimaryNavGroup | null>(null);
  const [showTourReminder, setShowTourReminder] = useState(false);

  const theme = useTheme();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.medium})`);

  const startInteraction = useCallback(() => {
    isInteractingRef.current = true;
  }, []);

  const endInteraction = useCallback(() => {
    isInteractingRef.current = false;
  }, []);

  const value = useMemo(
    () => ({
      navParentRef,
      secondaryNavEl,
      setSecondaryNavEl,
      layout: isMobile ? NavLayout.MOBILE : NavLayout.SIDEBAR,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      setActiveGroup,
      isInteractingRef,
      startInteraction,
      endInteraction,
      showTourReminder,
      setShowTourReminder,
    }),
    [
      secondaryNavEl,
      isMobile,
      isCollapsed,
      setIsCollapsed,
      activeGroup,
      startInteraction,
      endInteraction,
      showTourReminder,
      setShowTourReminder,
    ]
  );

  return <NavContext value={value}>{children}</NavContext>;
}
