import {
  createContext,
  useContext,
  useLayoutEffect,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {useSeerExplorerPolling} from 'sentry/views/seerExplorer/hooks/useSeerExplorerPolling';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

export type PollingState =
  | 'polling'
  | 'polling-with-backoff'
  | 'not-polling'
  | 'timed-out';

type ChatState = {
  polling: PollingState;
};

type SeerExplorerChatState = {
  chatStates: Record<SeerExplorerRunId, ChatState>;
  runId: SeerExplorerRunId | null;
};

type ChatStateAction =
  | {payload: {polling: PollingState; runId: SeerExplorerRunId}; type: 'set polling'}
  | {payload: SeerExplorerRunId | null; type: 'set run id'};

const RUN_ID_STORAGE_KEY = 'seer-explorer-run-id';

function readRunIdFromStorage(): SeerExplorerRunId | null {
  const raw = sessionStorageWrapper.getItem(RUN_ID_STORAGE_KEY);
  if (raw === null || raw === 'undefined') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'number' || typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function initState(): SeerExplorerChatState {
  return {
    runId: readRunIdFromStorage(),
    chatStates: {},
  };
}

function chatStateReducer(
  state: SeerExplorerChatState,
  action: ChatStateAction
): SeerExplorerChatState {
  switch (action.type) {
    case 'set polling': {
      if (state.chatStates[action.payload.runId]?.polling === action.payload.polling) {
        return state;
      }
      return {
        ...state,
        chatStates: {
          ...state.chatStates,
          [action.payload.runId]: {polling: action.payload.polling},
        },
      };
    }
    case 'set run id': {
      if (state.runId === action.payload) {
        return state;
      }
      return {...state, runId: action.payload};
    }
    default:
      return state;
  }
}

const SeerExplorerChatStateContext = createContext<SeerExplorerChatState>({
  runId: null,
  chatStates: {},
});
const SeerExplorerChatDispatchContext = createContext<Dispatch<ChatStateAction>>(
  () => {}
);

export function SeerExplorerChatStateProvider({children}: {children: ReactNode}) {
  const [state, dispatch] = useReducer(chatStateReducer, undefined, initState);

  useEffect(() => {
    try {
      if (state.runId === null) {
        sessionStorageWrapper.removeItem(RUN_ID_STORAGE_KEY);
      } else {
        sessionStorageWrapper.setItem(RUN_ID_STORAGE_KEY, JSON.stringify(state.runId));
      }
    } catch {
      // Best effort
    }
  }, [state.runId]);

  return (
    <SeerExplorerChatDispatchContext.Provider value={dispatch}>
      <SeerExplorerChatStateContext.Provider value={state}>
        <SeerExplorerChatStatePolling runId={state.runId} dispatch={dispatch}>
          {children}
        </SeerExplorerChatStatePolling>
      </SeerExplorerChatStateContext.Provider>
    </SeerExplorerChatDispatchContext.Provider>
  );
}

function SeerExplorerChatStatePolling({
  children,
  runId,
  dispatch,
}: {
  children: ReactNode;
  dispatch: Dispatch<ChatStateAction>;
  runId: SeerExplorerRunId | null;
}) {
  const {pollingState} = useSeerExplorerPolling({runId});

  useLayoutEffect(() => {
    if (runId === null) {
      return;
    }
    dispatch({type: 'set polling', payload: {runId, polling: pollingState}});
  }, [dispatch, runId, pollingState]);

  return children;
}

export function useSeerExplorerChatState(): SeerExplorerChatState {
  return useContext(SeerExplorerChatStateContext);
}

export function useSeerExplorerChatDispatch(): Dispatch<ChatStateAction> {
  return useContext(SeerExplorerChatDispatchContext);
}
