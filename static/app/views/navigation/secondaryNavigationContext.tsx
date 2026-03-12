import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/navigation/constants';

interface SecondaryNavigationContext {
  endInteraction: () => void;
  isCollapsed: boolean;
  isInteractingRef: React.RefObject<boolean | null>;
  isOpen: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  setIsOpen: (isOpen: boolean) => void;
  startInteraction: () => void;
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
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [isOpen, setIsOpen] = useState(false);

  const isInteractingRef = useRef(false);
  const startInteraction = useCallback(() => {
    isInteractingRef.current = true;
  }, []);
  const endInteraction = useCallback(() => {
    isInteractingRef.current = false;
  }, []);

  const value = useMemo(() => {
    return {
      isCollapsed,
      setIsCollapsed,
      isOpen,
      setIsOpen,
      isInteractingRef,
      startInteraction,
      endInteraction,
    };
  }, [
    isCollapsed,
    setIsCollapsed,
    isOpen,
    setIsOpen,
    isInteractingRef,
    startInteraction,
    endInteraction,
  ]);

  return (
    <SecondaryNavigationContext.Provider value={value}>
      {props.children}
    </SecondaryNavigationContext.Provider>
  );
}
