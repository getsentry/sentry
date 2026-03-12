import {createContext, useCallback, useContext, useRef, useState} from 'react';

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

const SecondaryNavigationContext = createContext<SecondaryNavigationContext>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  isOpen: false,
  setIsOpen: () => {},
  isInteractingRef: {current: false},
  startInteraction: () => {},
  endInteraction: () => {},
});

export function useSecondaryNavigation(): SecondaryNavigationContext {
  return useContext(SecondaryNavigationContext);
}

export function SecondaryNavigationContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <SecondaryNavigationContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed,
        isOpen,
        setIsOpen,
        isInteractingRef,
        startInteraction,
        endInteraction,
      }}
    >
      {children}
    </SecondaryNavigationContext.Provider>
  );
}
