import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/navigation/constants';

/**
 * The three possible states of the secondary navigation sidebar:
 * - 'expanded': Sidebar is always visible (user preference)
 * - 'collapsed': Sidebar is hidden (user preference, persisted)
 * - 'peek': Sidebar is temporarily visible via hover/focus while collapsed
 */
export type SecondaryNavState = 'expanded' | 'collapsed' | 'peek';

interface SecondaryNavigationContext {
  endInteraction: () => void;
  isInteractingRef: React.RefObject<boolean | null>;
  setView: (view: SecondaryNavState) => void;
  startInteraction: () => void;
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

  const isInteractingRef = useRef(false);
  const startInteraction = useCallback(() => {
    isInteractingRef.current = true;
  }, []);
  const endInteraction = useCallback(() => {
    isInteractingRef.current = false;
  }, []);

  const value = useMemo(() => {
    return {
      view,
      setView,
      isInteractingRef,
      startInteraction,
      endInteraction,
    };
  }, [view, setView, isInteractingRef, startInteraction, endInteraction]);

  return (
    <SecondaryNavigationContext.Provider value={value}>
      {props.children}
    </SecondaryNavigationContext.Provider>
  );
}
