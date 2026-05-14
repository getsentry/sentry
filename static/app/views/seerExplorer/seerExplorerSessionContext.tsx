import {createContext, useContext, useMemo, useReducer} from 'react';
import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

export function makeSeerExplorerSessionsQueryOptions(orgSlug: string) {
  return apiOptions.as<{data: ExplorerSession[]}>()(
    '/organizations/$organizationIdOrSlug/seer/explorer-runs/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {
        per_page: 20,
      },
      staleTime: 0,
    }
  );
}

function useSeerExplorerSessionsQuery({enabled = true}: {enabled?: boolean}) {
  const organization = useOrganization({allowNull: true});
  const isEnabled = enabled && isSeerExplorerEnabled(organization);

  return useQuery({
    ...makeSeerExplorerSessionsQueryOptions(organization?.slug ?? ''),
    enabled: isEnabled && !!organization,
  });
}

type SeerExplorerConversationsState = Record<number, {status: 'active' | 'idle'}>;
type SeerExplorerConversationsAction =
  | {payload: number; type: 'set active run'}
  | {type: 'clear active run'};

function seerExplorerConversationsReducer(
  state: SeerExplorerConversationsState,
  action: SeerExplorerConversationsAction
): SeerExplorerConversationsState {
  switch (action.type) {
    case 'set active run': {
      const next: SeerExplorerConversationsState = {};
      for (const key in state) {
        next[key] = {...state[key], status: 'idle'};
      }
      next[action.payload] = {...state[action.payload], status: 'active'};
      return next;
    }
    case 'clear active run': {
      const next: SeerExplorerConversationsState = {};
      for (const key in state) {
        next[key] = {...state[key], status: 'idle'};
      }
      return next;
    }
    default:
      return state;
  }
}

export interface Conversation extends ExplorerSession {
  status: 'active' | 'idle';
}

type SeerExplorerSessionsContextValue = {
  conversations: Conversation[];
  query: ReturnType<typeof useSeerExplorerSessionsQuery>;
};

const SeerExplorerSessionsContext =
  createContext<SeerExplorerSessionsContextValue | null>(null);
const SeerExplorerDispatchContext =
  createContext<React.Dispatch<SeerExplorerConversationsAction> | null>(null);

export function SeerExplorerSessionsProvider({children}: {children: React.ReactNode}) {
  const organization = useOrganization({allowNull: true});

  const query = useSeerExplorerSessionsQuery({
    enabled: isSeerExplorerEnabled(organization),
  });

  const [state, dispatch] = useReducer(seerExplorerConversationsReducer, null, () => {
    const persisted = readPersistedRunId();
    if (persisted !== null) {
      return {[persisted]: {status: 'active' as const}};
    }
    return {};
  });

  function wrappedDispatch(action: SeerExplorerConversationsAction) {
    switch (action.type) {
      case 'set active run':
        persistRunId(action.payload);
        break;
      case 'clear active run':
        persistRunId(null);
        break;
    }
    dispatch(action);
  }

  const conversations = useMemo<Conversation[]>(() => {
    if (!query.data?.data?.length) return [];

    return query.data.data.map(session => ({
      ...session,
      status: state[session.run_id]?.status ?? 'idle',
    }));
  }, [query.data?.data, state]);

  const contextValue = useMemo(() => ({query, conversations}), [query, conversations]);

  return (
    <SeerExplorerDispatchContext.Provider value={wrappedDispatch}>
      <SeerExplorerSessionsContext.Provider value={contextValue}>
        {children}
      </SeerExplorerSessionsContext.Provider>
    </SeerExplorerDispatchContext.Provider>
  );
}

export function useSeerExplorerSessions(): SeerExplorerSessionsContextValue {
  const ctx = useContext(SeerExplorerSessionsContext);
  if (!ctx) {
    throw new Error(
      'useSeerExplorerSessions must be used within SeerExplorerSessionsProvider'
    );
  }
  return ctx;
}

export function useSeerExplorerDispatch(): React.Dispatch<SeerExplorerConversationsAction> {
  const ctx = useContext(SeerExplorerDispatchContext);
  if (!ctx) {
    throw new Error(
      'useSeerExplorerDispatch must be used within SeerExplorerSessionsProvider'
    );
  }
  return ctx;
}

const STORAGE_KEY = 'seer-explorer-run-id';

function readPersistedRunId(): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === 'undefined') return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

function persistRunId(runId: number | null) {
  try {
    if (runId === null) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(runId));
    }
  } catch {
    // best effort
  }
}
