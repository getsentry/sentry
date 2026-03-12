import {createContext, useContext, useState} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/navigation/constants';

interface SecondaryNavigationContext {
  isCollapsed: boolean;
  isOpen: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  setIsOpen: (isOpen: boolean) => void;
}

const SecondaryNavigationContext = createContext<SecondaryNavigationContext>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  isOpen: false,
  setIsOpen: () => {},
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

  return (
    <SecondaryNavigationContext.Provider
      value={{isCollapsed, setIsCollapsed, isOpen, setIsOpen}}
    >
      {children}
    </SecondaryNavigationContext.Provider>
  );
}
