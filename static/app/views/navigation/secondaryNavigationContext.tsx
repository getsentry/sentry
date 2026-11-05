import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from './constants';

/**
 * The three possible states of the secondary navigation sidebar:
 * - 'expanded': Sidebar is always visible (user preference)
 * - 'collapsed': Sidebar is hidden (user preference, persisted)
 * - 'peek': Sidebar is temporarily visible via hover/focus while collapsed
 */
type SecondaryNavState = 'expanded' | 'collapsed' | 'peek';

interface SecondaryNavigationContext {
  isForceCollapsed: boolean;
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
  /**
   * Keeps the sidebar collapsed without changing the persisted preference.
   * It can still peek to preview other groups.
   */
  forceCollapsed?: boolean;
}

export function SecondaryNavigationContextProvider(
  props: SecondaryNavigationContextProviderProps
) {
  const {forceCollapsed = false} = props;
  const [isCollapsedPersisted, setIsCollapsedPersisted] = useLocalStorageState(
    NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [isPeeking, setIsPeeking] = useState(false);

  const isCollapsed = forceCollapsed || isCollapsedPersisted;
  // A peek only exists while collapsed. Drop it when leaving a page that
  // forced the sidebar collapsed into an expanded preference.
  if (!isCollapsed && isPeeking) {
    setIsPeeking(false);
  }
  const view: SecondaryNavState = isCollapsed
    ? isPeeking
      ? 'peek'
      : 'collapsed'
    : 'expanded';

  const setView = useCallback(
    (nextView: SecondaryNavState) => {
      setIsPeeking(nextView === 'peek');
      if (nextView !== 'peek' && !forceCollapsed) {
        setIsCollapsedPersisted(nextView === 'collapsed');
      }
    },
    [forceCollapsed, setIsCollapsedPersisted]
  );

  const value = useMemo(() => {
    return {
      view,
      setView,
      isForceCollapsed: forceCollapsed,
    };
  }, [forceCollapsed, view, setView]);

  return (
    <SecondaryNavigationContext.Provider value={value}>
      {props.children}
    </SecondaryNavigationContext.Provider>
  );
}

/**
 * Mobile-only secondary navigation context provider. Unlike the desktop
 * provider, state is stored entirely in memory (no localStorage) and only
 * supports 'expanded' | 'collapsed' — mobile has no hover-based 'peek' state.
 *
 * Rendering the mobile navigation tree inside this provider ensures mobile
 * open/close interactions never bleed into the desktop navigation's persisted
 * collapsed preference.
 */
export function MobileSecondaryNavigationContextProvider(
  props: SecondaryNavigationContextProviderProps
) {
  const [view, setViewState] = useState<'expanded' | 'collapsed'>('expanded');

  const setView = useCallback((nextView: SecondaryNavState) => {
    if (nextView !== 'peek') {
      setViewState(nextView);
    }
  }, []);

  const value = useMemo(
    () => ({view, setView, isForceCollapsed: false}),
    [view, setView]
  );

  return (
    <SecondaryNavigationContext.Provider value={value}>
      {props.children}
    </SecondaryNavigationContext.Provider>
  );
}
