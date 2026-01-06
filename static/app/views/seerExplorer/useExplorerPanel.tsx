import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useRoutes} from 'sentry/utils/useRoutes';

type ExplorerPanelContextValue = {
  closeExplorerPanel: () => void;
  isOpen: boolean;
  openExplorerPanel: () => void;
  // Tracks the normalized path of the current page (e.g. /issues/:groupId/) for analytics. Excludes query params.
  // This ref is stable except when other context fields change.
  referrerRef: Readonly<RefObject<string>>;

  toggleExplorerPanel: () => void;
};

const ExplorerPanelContext = createContext<ExplorerPanelContextValue>({
  closeExplorerPanel: () => {},
  referrerRef: {current: ''},
  isOpen: false,
  openExplorerPanel: () => {},
  toggleExplorerPanel: () => {},
});

export function ExplorerPanelProvider({children}: {children: ReactNode}) {
  // Initialize the global explorer panel state. Includes hotkeys.
  const [isOpen, setIsOpen] = useState(false);

  // Ref synced with the current page's route string
  const routes = useRoutes();
  const routeString = getRouteStringFromRoutes(routes);
  const routeStringRef = useRef(routeString);

  useEffect(() => {
    routeStringRef.current = routeString;
  }, [routeString]);

  const openExplorerPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeExplorerPanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleExplorerPanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const contextValue = useMemo(
    () => ({
      isOpen,
      openExplorerPanel,
      closeExplorerPanel,
      toggleExplorerPanel,
      referrerRef: routeStringRef,
    }),
    [isOpen, openExplorerPanel, closeExplorerPanel, toggleExplorerPanel, routeStringRef]
  );

  // Hot keys for toggling the explorer panel.
  const {visible: isModalOpen} = useGlobalModal();

  useHotkeys(
    isModalOpen
      ? []
      : [
          {
            match: ['command+/', 'ctrl+/', 'command+.', 'ctrl+.'],
            callback: () => toggleExplorerPanel(),
            includeInputs: true,
          },
        ]
  );

  return (
    <ExplorerPanelContext.Provider value={contextValue}>
      {children}
    </ExplorerPanelContext.Provider>
  );
}

export function useExplorerPanel(): ExplorerPanelContextValue {
  return useContext(ExplorerPanelContext);
}
