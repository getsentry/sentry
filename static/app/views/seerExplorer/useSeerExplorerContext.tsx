import {createContext, useContext, type RefObject} from 'react';

import type {OpenSeerExplorerDrawerOptions} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import type {SeerExplorerSidebarPosition} from 'sentry/views/seerExplorer/types';

type SeerExplorerSessionState = 'inactive' | 'thinking' | 'done-thinking';

export type SeerExplorerContextValue = {
  closeSeerExplorer: () => void;
  isOpen: boolean;
  /**
   * Opens Explorer on an "Ask Seer" question from Seer and sends nothing until the user
   * replies. `context` is any JSON-serializable value describing what the question is about.
   */
  openChatPrompt: (options: {prompt: string; context?: unknown}) => void;
  openSeerExplorer: (options?: OpenSeerExplorerDrawerOptions) => void;
  sessionState: SeerExplorerSessionState;
  /**
   * Persisted sidebar dock preference. Only meaningful in sidebar mode.
   */
  setSidebarPosition: (position: SeerExplorerSidebarPosition) => void;
  /**
   * Query to auto-submit into the sidebar content, forwarded from the command
   * palette. Only meaningful in sidebar mode.
   */
  /** Whether `sidebarInitialQuery` goes into the open run. Sidebar mode only. */
  sidebarAppendInitialQuery: boolean;
  /**
   * Ref attached by the sidebar layout to its measuring container, so the
   * provider can read the available size when persisting the popped-out
   * window's size. Only meaningful in sidebar mode.
   */
  sidebarContainerRef: RefObject<HTMLDivElement | null>;
  sidebarInitialQuery: string | undefined;
  /**
   * Increments on each forwarded query so the (always-mounted) sidebar content
   * resubmits a re-forwarded query. Only meaningful in sidebar mode.
   */
  sidebarKey: number;
  sidebarPosition: SeerExplorerSidebarPosition;
  toggleSeerExplorer: () => void;
  unreadCount: number;
};

// The provider lives in seerExplorerContextProvider.tsx, so modules that only read
// this context (the top bar, the command palette) don't load the Explorer UI.
export const SeerExplorerContext = createContext<SeerExplorerContextValue>({
  closeSeerExplorer: () => {},
  isOpen: false,
  openChatPrompt: () => {},
  openSeerExplorer: () => {},
  sessionState: 'inactive',
  sidebarContainerRef: {current: null},
  setSidebarPosition: () => {},
  sidebarAppendInitialQuery: false,
  sidebarInitialQuery: undefined,
  sidebarKey: 0,
  sidebarPosition: 'auto',
  toggleSeerExplorer: () => {},
  unreadCount: 0,
});

export function useSeerExplorerContext(): SeerExplorerContextValue {
  return useContext(SeerExplorerContext);
}
