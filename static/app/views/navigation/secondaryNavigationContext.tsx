import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from './constants';
import {useSettingsNavigation} from './useSettingsNavigation';

/**
 * The three possible states of the secondary navigation sidebar:
 * - 'expanded': Sidebar is always visible (user preference)
 * - 'collapsed': Sidebar is hidden (user preference, persisted)
 * - 'peek': Sidebar is temporarily visible via hover/focus while collapsed
 */
type SecondaryNavState = 'expanded' | 'collapsed' | 'peek';

interface SecondaryNavigationContext {
  /**
   * When false, the page decides whether the sidebar is collapsed, so the user
   * cannot toggle it and their collapsed preference is left untouched.
   */
  collapsible: boolean;
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

interface DesktopSecondaryNavigationContextProviderProps extends SecondaryNavigationContextProviderProps {
  /**
   * Keeps the sidebar collapsed, so it only shows as a peek over the page. Used
   * on pages without a secondary navigation of their own.
   */
  forceCollapsed?: boolean;
}

export function SecondaryNavigationContextProvider({
  children,
  forceCollapsed = false,
}: DesktopSecondaryNavigationContextProviderProps) {
  const [isCollapsedPersisted, setIsCollapsedPersisted] = useLocalStorageState(
    NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
    false
  );
  const [view, setViewState] = useState<SecondaryNavState>(
    isCollapsedPersisted ? 'collapsed' : 'expanded'
  );
  // Peeks on a force-collapsed page are kept apart from `view`, so they never
  // overwrite the collapsed preference for the rest of the app.
  const [isForcedPeek, setIsForcedPeek] = useState(false);
  // Settings has too little in its sidebar to be worth hiding, so it ignores the
  // collapsed preference without overwriting it for the rest of the app.
  const forceExpanded = useSettingsNavigation();
  const collapsible = !forceExpanded && !forceCollapsed;

  // A peek that was open when the user entered settings or a force-collapsed
  // page must not reopen as an unhovered peek once they leave.
  if (!collapsible && view === 'peek') {
    setViewState('collapsed');
  }
  if (!forceCollapsed && isForcedPeek) {
    setIsForcedPeek(false);
  }

  const setView = useCallback(
    (nextView: SecondaryNavState) => {
      if (forceExpanded) {
        return;
      }
      if (forceCollapsed) {
        setIsForcedPeek(nextView === 'peek');
        return;
      }
      setViewState(nextView);
      if (nextView !== 'peek') {
        setIsCollapsedPersisted(nextView === 'collapsed');
      }
    },
    [forceExpanded, forceCollapsed, setIsCollapsedPersisted]
  );

  const currentView: SecondaryNavState = forceExpanded
    ? 'expanded'
    : forceCollapsed
      ? isForcedPeek
        ? 'peek'
        : 'collapsed'
      : view;

  const value = useMemo(
    () => ({collapsible, view: currentView, setView}),
    [collapsible, currentView, setView]
  );

  return (
    <SecondaryNavigationContext.Provider value={value}>
      {children}
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

  const value = useMemo(() => ({collapsible: true, view, setView}), [view, setView]);

  return (
    <SecondaryNavigationContext.Provider value={value}>
      {props.children}
    </SecondaryNavigationContext.Provider>
  );
}
