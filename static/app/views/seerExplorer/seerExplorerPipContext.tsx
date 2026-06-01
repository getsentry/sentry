import {createContext, useContext, useMemo, type ReactNode} from 'react';

import {usePictureInPicture} from 'sentry/utils/usePictureInPicture';

interface SeerExplorerPipContextValue {
  closePipWindow: () => void;
  isSupported: boolean;
  pipWindow: Window | null;
  requestPipWindow: ReturnType<typeof usePictureInPicture>['openPipWindow'];
}

const SeerExplorerPipContext = createContext<SeerExplorerPipContextValue | null>(null);

/**
 * Owns the picture-in-picture window used to pop the Seer Explorer drawer out
 * into a separate window.
 *
 * Must be mounted ABOVE `GlobalDrawer` so it is an ancestor of both the drawer
 * panel content (which `GlobalDrawer` renders as a sibling of its children) and
 * the app tree. This lets the docked drawer trigger pop-out and the always-
 * mounted host render the popped-out content from the same window instance.
 */
export function SeerExplorerPipProvider({children}: {children: ReactNode}) {
  const {pipWindow, isSupported, openPipWindow, closePipWindow} = usePictureInPicture();

  const value = useMemo<SeerExplorerPipContextValue>(
    () => ({
      pipWindow,
      isSupported,
      requestPipWindow: openPipWindow,
      closePipWindow,
    }),
    [pipWindow, isSupported, openPipWindow, closePipWindow]
  );

  return (
    <SeerExplorerPipContext.Provider value={value}>
      {children}
    </SeerExplorerPipContext.Provider>
  );
}

export function useSeerExplorerPip(): SeerExplorerPipContextValue {
  const context = useContext(SeerExplorerPipContext);

  if (!context) {
    throw new Error('useSeerExplorerPip must be used within a SeerExplorerPipProvider');
  }

  return context;
}
