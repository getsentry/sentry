import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/navigation/constants';

/**
 * The three possible states of the secondary navigation sidebar:
 * - 'expanded': Sidebar is always visible (user preference)
 * - 'collapsed': Sidebar is hidden (user preference, persisted)
 * - 'peek': Sidebar is temporarily visible via hover/focus while collapsed
 */
type SecondaryNavState = 'expanded' | 'collapsed' | 'peek';

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
      if (nextView !== 'peek') {
        setIsCollapsedPersisted(nextView === 'collapsed');
      }
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
