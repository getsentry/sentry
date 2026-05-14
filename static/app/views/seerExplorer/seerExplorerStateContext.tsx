import {createContext, useContext, useMemo, useReducer} from 'react';

import {useSeerExplorerSessions} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';

type SeerExplorerConversationsState = Record<number, {status: 'active' | 'idle'}>;
type SeerExplorerConversationsAction = {payload: number; type: 'set active run'};

function seerExplorerConversationsReducer(
  state: SeerExplorerConversationsState,
  action: SeerExplorerConversationsAction
): SeerExplorerConversationsState {
  switch (action.type) {
    case 'set active run': {
      persistRunId(action.payload);
      return {...state, [action.payload]: {status: 'active'}};
    }
    default:
      return state;
  }
}

export type Conversation = ExplorerSession & {
  status: 'active' | 'idle';
};

const SeerExplorerConversationsContext = createContext<Conversation[] | null>(null);
const SeerExplorerDispatchContext =
  createContext<React.Dispatch<SeerExplorerConversationsAction> | null>(null);

export function SeerExplorerStateProvider({children}: {children: React.ReactNode}) {
  const sessionsQuery = useSeerExplorerSessions();

  const [state, dispatch] = useReducer(seerExplorerConversationsReducer, null, () => {
    const persisted = readPersistedRunId();
    if (persisted !== null) {
      return {[persisted]: {status: 'active' as const}};
    }
    return {};
  });

  const conversations = useMemo<Conversation[]>(() => {
    if (!sessionsQuery.data?.data?.length) return [];

    return sessionsQuery.data.data.map(session => ({
      ...session,
      status: state[session.run_id]?.status ?? 'idle',
    }));
  }, [sessionsQuery.data?.data, state]);

  return (
    <SeerExplorerDispatchContext.Provider value={dispatch}>
      <SeerExplorerConversationsContext.Provider value={conversations}>
        {children}
      </SeerExplorerConversationsContext.Provider>
    </SeerExplorerDispatchContext.Provider>
  );
}

export function useSeerExplorerConversations(): Conversation[] {
  const ctx = useContext(SeerExplorerConversationsContext);
  if (!ctx) {
    throw new Error(
      'useSeerExplorerConversations must be used within SeerExplorerStateProvider'
    );
  }
  return ctx;
}

export function useSeerExplorerDispatch(): React.Dispatch<SeerExplorerConversationsAction> {
  const ctx = useContext(SeerExplorerDispatchContext);
  if (!ctx) {
    throw new Error(
      'useSeerExplorerDispatch must be used within SeerExplorerStateProvider'
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
