import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';
import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/nav/constants';
import type {PrimaryNavGroup} from 'sentry/views/nav/types';
import {NavLayout} from 'sentry/views/nav/types';

interface NavContext {
  activePrimaryNavGroup: PrimaryNavGroup | null;
  collapsedNavIsOpen: boolean;
  endInteraction: () => void;
  isCollapsed: boolean;
  isInteractingRef: React.RefObject<boolean | null>;
  layout: NavLayout;
  navParentRef: React.RefObject<HTMLDivElement | null>;
  setActivePrimaryNavGroup: (activePrimaryNavGroup: PrimaryNavGroup | null) => void;
  setCollapsedNavIsOpen: (collapsedNavIsOpen: boolean) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  setShowTourReminder: (showTourReminder: boolean) => void;
  showTourReminder: boolean;
  startInteraction: () => void;
}

const NavContext = createContext<NavContext>({
  navParentRef: {current: null},
  layout: NavLayout.SIDEBAR,
  isCollapsed: false,
  setIsCollapsed: () => {},
  isInteractingRef: {current: false},
  startInteraction: () => {},
  endInteraction: () => {},
  showTourReminder: false,
  setShowTourReminder: () => {},
  activePrimaryNavGroup: null,
  setActivePrimaryNavGroup: () => {},
  collapsedNavIsOpen: false,
  setCollapsedNavIsOpen: () => {},
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
  const [collapsedNavIsOpen, setCollapsedNavIsOpen] = useState(false);
  const [showTourReminder, setShowTourReminder] = useState(false);
  const [activePrimaryNavGroup, setActivePrimaryNavGroup] =
    useState<PrimaryNavGroup | null>(null);

  const theme = useTheme();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.md})`);

  const startInteraction = useCallback(() => {
    isInteractingRef.current = true;
  }, []);

  const endInteraction = useCallback(() => {
    isInteractingRef.current = false;
  }, []);

  const value = useMemo(
    () => ({
      navParentRef,
      layout: isMobile ? NavLayout.MOBILE : NavLayout.SIDEBAR,
      isCollapsed,
      setIsCollapsed,
      isInteractingRef,
      startInteraction,
      endInteraction,
      showTourReminder,
      setShowTourReminder,
      activePrimaryNavGroup,
      setActivePrimaryNavGroup,
      collapsedNavIsOpen,
      setCollapsedNavIsOpen,
    }),
    [
      isMobile,
      isCollapsed,
      setIsCollapsed,
      startInteraction,
      endInteraction,
      showTourReminder,
      setShowTourReminder,
      activePrimaryNavGroup,
      setActivePrimaryNavGroup,
      collapsedNavIsOpen,
      setCollapsedNavIsOpen,
    ]
  );

  return <NavContext value={value}>{children}</NavContext>;
}
