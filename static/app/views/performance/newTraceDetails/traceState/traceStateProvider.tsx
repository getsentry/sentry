import type React from 'react';
import {createContext, useContext, useLayoutEffect, useMemo} from 'react';
import * as qs from 'query-string';

import {t} from 'sentry/locale';
import {
  type DispatchingReducerEmitter,
  useDispatchingReducer,
} from 'sentry/utils/useDispatchingReducer';

import {useHasTraceNewUi} from '../useHasTraceNewUi';

import {TraceReducer, type TraceReducerAction, type TraceReducerState} from './index';
import {storeTraceViewPreferences, type TracePreferencesState} from './tracePreferences';

interface TraceStateContext {}

export const TraceStateContext = createContext<TraceReducerState | null>(null);
export const TraceStateDispatchContext =
  createContext<React.Dispatch<TraceReducerAction> | null>(null);
export const TraceStateEmitterContext = createContext<DispatchingReducerEmitter<
  typeof TraceReducer
> | null>(null);

export function useTraceState(): TraceReducerState {
  const context = useContext(TraceStateContext);

  if (!context) {
    throw new Error('useTraceState must be used within a TraceStateProvider');
  }

  return context;
}

export function useTraceStateDispatch(): React.Dispatch<TraceReducerAction> {
  const context = useContext(TraceStateDispatchContext);

  if (!context) {
    throw new Error('useTraceStateDispatch must be used within a TraceStateProvider');
  }

  return context;
}

export function useTraceStateEmitter(): DispatchingReducerEmitter<typeof TraceReducer> {
  const context = useContext(TraceStateEmitterContext);

  if (!context) {
    throw new Error('useTraceStateEmitter must be used within a TraceStateProvider');
  }

  return context;
}

const TRACE_TAB: TraceReducerState['tabs']['tabs'][0] = {
  node: 'trace',
  label: t('Trace'),
};

const STATIC_DRAWER_TABS: TraceReducerState['tabs']['tabs'] = [TRACE_TAB];
interface TraceStateProviderProps {
  children: React.ReactNode;
  initialPreferences: TracePreferencesState;
  preferencesStorageKey?: string;
}

export function TraceStateProvider(props: TraceStateProviderProps): React.ReactNode {
  const hasTraceNewUi = useHasTraceNewUi();
  const initialQuery = useMemo((): string | undefined => {
    const query = qs.parse(location.search);

    if (typeof query.search === 'string') {
      return query.search;
    }
    return undefined;
    // We only want to decode on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [traceState, traceDispatch, traceStateEmitter] = useDispatchingReducer(
    TraceReducer,
    {
      rovingTabIndex: {
        index: null,
        items: null,
        node: null,
      },
      search: {
        node: null,
        query: initialQuery,
        resultIteratorIndex: null,
        resultIndex: null,
        results: null,
        status: undefined,
        resultsLookup: new Map(),
      },
      preferences: props.initialPreferences,
      tabs: {
        tabs: hasTraceNewUi ? [] : STATIC_DRAWER_TABS,
        current_tab: hasTraceNewUi ? null : STATIC_DRAWER_TABS[0] ?? null,
        last_clicked_tab: null,
      },
    }
  );

  useLayoutEffect(() => {
    if (props.preferencesStorageKey) {
      storeTraceViewPreferences(props.preferencesStorageKey, traceState.preferences);
    }
  }, [traceState.preferences, props.preferencesStorageKey]);

  return (
    <TraceStateContext.Provider value={traceState}>
      <TraceStateDispatchContext.Provider value={traceDispatch}>
        <TraceStateEmitterContext.Provider value={traceStateEmitter}>
          {props.children}
        </TraceStateEmitterContext.Provider>
      </TraceStateDispatchContext.Provider>
    </TraceStateContext.Provider>
  );
}
