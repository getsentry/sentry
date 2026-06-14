import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {
  useWidgetBuilderState,
  type WidgetBuilderState,
  type WidgetBuilderStore,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

type WidgetBuilderContextValue = Pick<
  ReturnType<typeof useWidgetBuilderState>,
  'state' | 'dispatch'
>;

const WidgetBuilderContext = createContext<WidgetBuilderContextValue | undefined>(
  undefined
);

/**
 * Carries the widget builder store itself. The store's identity is stable for
 * the lifetime of the builder, so consuming this context never causes a
 * re-render — subscriptions happen through the selector hooks below.
 */
const WidgetBuilderStoreContext = createContext<WidgetBuilderStore | undefined>(
  undefined
);

interface WidgetBuilderProviderProps {
  children: React.ReactNode;
}

const EMPTY_STATE: WidgetBuilderState = {};
const EMPTY_URL_PARAMS = {};

/**
 * Builds a read-only store view over a mocked `useWidgetBuilderState` return
 * value so the selector hooks keep working in tests that mock the hook (e.g.
 * dashboard detail tests). The mocked state is static, so subscriptions are
 * no-ops; values are read through the ref so consumers see the latest mock.
 */
function createFallbackStore(
  latestRef: React.RefObject<WidgetBuilderContextValue | undefined>
): WidgetBuilderStore {
  return {
    dispatch: (action, options) => latestRef.current?.dispatch(action, options),
    getState: () => latestRef.current?.state ?? EMPTY_STATE,
    getUrlParams: () => EMPTY_URL_PARAMS,
    subscribe: () => () => {},
    syncUrlParams: () => {},
    teardown: () => {},
  };
}

/**
 * Provider for maintaining a single source of truth for the widget builder state.
 */
function WidgetBuilderStateProvider({children}: WidgetBuilderProviderProps) {
  const widgetBuilderState = useWidgetBuilderState();

  // `useWidgetBuilderState` may be jest-mocked without a `store`; fall back to
  // a static store view over the mocked state so selector hooks keep working.
  const latestRef = useRef<WidgetBuilderContextValue | undefined>(widgetBuilderState);
  latestRef.current = widgetBuilderState;
  const [fallbackStore] = useState(() =>
    widgetBuilderState?.store ? null : createFallbackStore(latestRef)
  );

  return (
    <WidgetBuilderStoreContext.Provider
      value={widgetBuilderState?.store ?? fallbackStore ?? undefined}
    >
      <WidgetBuilderContext.Provider value={widgetBuilderState}>
        <WidgetBuilderUrlParamSync />
        {children}
      </WidgetBuilderContext.Provider>
    </WidgetBuilderStoreContext.Provider>
  );
}

export function WidgetBuilderProvider({children}: WidgetBuilderProviderProps) {
  return <WidgetBuilderStateProvider>{children}</WidgetBuilderStateProvider>;
}

/**
 * The widget builder store writes its query params to the URL without
 * notifying the router. When something else navigates (e.g. a page filter
 * change), the router rebuilds the URL from its own location and drops those
 * params, so re-assert them here. Renders nothing, so the `useLocation`
 * subscription is cheap.
 */
function WidgetBuilderUrlParamSync() {
  const store = useContext(WidgetBuilderStoreContext);
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Skip when navigating away from the builder (e.g. closing it), where the
    // params are being cleaned up intentionally
    if (location.pathname.includes('/widget-builder/')) {
      store?.syncUrlParams();
    }
  }, [location, store]);

  return null;
}

/**
 * Custom hook to get state and dispatch from the WidgetBuilderContext
 *
 * Subscribes to the full widget builder state — any state change re-renders
 * the caller. Prefer `useWidgetBuilderStateSlice`/`useWidgetBuilderDispatch`
 * unless the whole state is genuinely needed at render time.
 */
export const useWidgetBuilderContext = () => {
  const context = useContext(WidgetBuilderContext);
  if (!context) {
    throw new Error(
      'useWidgetBuilderContext must be used within a WidgetBuilderProvider'
    );
  }
  return context;
};

/**
 * Returns the widget builder store. Useful for reading state inside event
 * handlers (`store.getState()`) without subscribing to re-renders.
 */
export function useWidgetBuilderStore(): WidgetBuilderStore {
  const store = useContext(WidgetBuilderStoreContext);
  if (!store) {
    throw new Error('useWidgetBuilderStore must be used within a WidgetBuilderProvider');
  }
  return store;
}

/**
 * Returns the widget builder dispatch function without subscribing to any
 * state changes.
 */
export function useWidgetBuilderDispatch(): WidgetBuilderStore['dispatch'] {
  return useWidgetBuilderStore().dispatch;
}

/**
 * Subscribes to a subset of the widget builder state. The caller only
 * re-renders when one of the selected fields changes.
 *
 *   const {dataset, displayType} = useWidgetBuilderStateSlice('dataset', 'displayType');
 */
export function useWidgetBuilderStateSlice<K extends keyof WidgetBuilderState>(
  ...keys: K[]
): Pick<WidgetBuilderState, K> {
  const store = useWidgetBuilderStore();

  const keysRef = useRef(keys);
  keysRef.current = keys;
  const cacheRef = useRef<{
    selection: Pick<WidgetBuilderState, K>;
    snapshot: WidgetBuilderState;
  } | null>(null);

  const getSnapshot = useCallback(() => {
    const snapshot = store.getState();
    const cached = cacheRef.current;
    if (cached?.snapshot === snapshot) {
      return cached.selection;
    }

    const selection = {} as Pick<WidgetBuilderState, K>;
    for (const key of keysRef.current) {
      selection[key] = snapshot[key];
    }

    // Keep the previous selection's identity when the selected fields are
    // unchanged so subscribers bail out of re-rendering
    if (
      cached &&
      keysRef.current.every(key => Object.is(cached.selection[key], selection[key]))
    ) {
      cacheRef.current = {snapshot, selection: cached.selection};
      return cached.selection;
    }

    cacheRef.current = {snapshot, selection};
    return selection;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot);
}

const WIDGET_QUERY_STATE_KEYS = [
  'axisRange',
  'dataset',
  'displayType',
  'fields',
  'legendAlias',
  'legendType',
  'limit',
  'linkedDashboards',
  'query',
  'selectedAggregate',
  'sort',
  'thresholds',
  'yAxis',
] as const;

/**
 * Subscribes to every widget builder state field that affects the widget's
 * queries — i.e. everything except `title`, `description`, and `textContent`.
 * Use for components that derive the widget query at render time (e.g. via
 * `convertBuilderStateToWidget`) but should not re-render while the user
 * types a title or description.
 */
export function useWidgetBuilderQueryState(): Pick<
  WidgetBuilderState,
  (typeof WIDGET_QUERY_STATE_KEYS)[number]
> {
  return useWidgetBuilderStateSlice(...WIDGET_QUERY_STATE_KEYS);
}

/**
 * Subscribes to the serialized query params the widget builder has written to
 * the URL. Merge these over `location.query` when checking the URL for widget
 * state, since the store writes the URL without notifying the router.
 */
export function useWidgetBuilderUrlParams() {
  const store = useWidgetBuilderStore();
  return useSyncExternalStore(store.subscribe, store.getUrlParams);
}
