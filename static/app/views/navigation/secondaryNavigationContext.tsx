import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from './constants';

/**
 * The two possible states of the secondary navigation sidebar, persisted:
 * - 'expanded': Sidebar is open. Opened by clicking a primary nav item.
 * - 'collapsed': Sidebar is closed. Closed with the sidebar's close button.
 */
type SecondaryNavState = 'expanded' | 'collapsed';

interface SecondaryNavigationContext {
  setView: (view: SecondaryNavState) => void;
  view: SecondaryNavState;
}

const SecondaryNavigationContext = createContext<SecondaryNavigationContext | null>(null);

export function useSecondaryNavigation(): SecondaryNavigationContext {
  const context = useContext(SecondaryNavigationContext);
  if (!context) {
    throw new Error(
      'useSecondaryNavigation must be used within a SecondaryNavigationContextProvider'
    );
  }
  return context;
}

interface SecondaryNavigationContextProviderProps {
  children: React.ReactNode;
}

export function SecondaryNavigationContextProvider(
  props: SecondaryNavigationContextProviderProps
) {
  const [isCollapsedPersisted, setIsCollapsedPersisted] = useLocalStorageState(
    NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [view, setViewState] = useState<SecondaryNavState>(
    isCollapsedPersisted ? 'collapsed' : 'expanded'
  );

  const setView = useCallback(
    (nextView: SecondaryNavState) => {
      setViewState(nextView);
      setIsCollapsedPersisted(nextView === 'collapsed');
    },
    [setIsCollapsedPersisted]
  );

  const value = useMemo(() => {
    return {
      view,
      setView,
    };
  }, [view, setView]);

  return (
    <SecondaryNavigationContext.Provider value={value}>
      {props.children}
    </SecondaryNavigationContext.Provider>
  );
}

/**
 * Mobile-only secondary navigation context provider. Unlike the desktop
 * provider, state is stored entirely in memory (no localStorage).
 *
 * Rendering the mobile navigation tree inside this provider ensures mobile
 * open/close interactions never bleed into the desktop navigation's persisted
 * collapsed preference.
 */
export function MobileSecondaryNavigationContextProvider(
  props: SecondaryNavigationContextProviderProps
) {
  const [view, setView] = useState<SecondaryNavState>('expanded');

  const value = useMemo(() => ({view, setView}), [view]);

  return (
    <SecondaryNavigationContext.Provider value={value}>
      {props.children}
    </SecondaryNavigationContext.Provider>
  );
}
