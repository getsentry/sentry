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
import type {ChatPrompt} from 'sentry/views/seerExplorer/chatPrompt';
import {useSeerExplorerPolling} from 'sentry/views/seerExplorer/hooks/useSeerExplorerPolling';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {SeerExplorerDeepLinkParamProvider} from 'sentry/views/seerExplorer/utils';

export type PollingState =
  | 'polling'
  | 'polling-with-backoff'
  | 'not-polling'
  | 'timed-out';

type ChatState = {
  polling: PollingState;
};

type SeerExplorerChatState = {
  /** An "Ask Seer" question waiting for the user's reply. Never persisted. */
  chatPrompt: ChatPrompt | null;
  chatStates: Record<SeerExplorerRunId, ChatState>;
  runId: SeerExplorerRunId | null;
};

type ChatStateAction =
  | {payload: {polling: PollingState; runId: SeerExplorerRunId}; type: 'set polling'}
  | {payload: SeerExplorerRunId | null; type: 'set run id'}
  /** The unsaved chat on screen was created on the server; it's the same conversation. */
  | {payload: SeerExplorerRunId; type: 'set created run id'}
  | {payload: ChatPrompt | null; type: 'set chat prompt'}
  /** Puts back a prompt whose send failed, unless a newer one has taken its place. */
  | {payload: ChatPrompt; type: 'restore chat prompt'};

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
    chatPrompt: null,
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
      // A pending question belongs to the conversation it was asked in.
      return {...state, runId: action.payload, chatPrompt: null};
    }
    case 'set created run id': {
      if (state.runId === action.payload) {
        return state;
      }
      // Still on the unsaved chat, so its pending question stays; otherwise the user has
      // moved on and this is an ordinary run change.
      return {
        ...state,
        runId: action.payload,
        chatPrompt: state.runId === null ? state.chatPrompt : null,
      };
    }
    case 'set chat prompt': {
      if (state.chatPrompt === action.payload) {
        return state;
      }
      return {...state, chatPrompt: action.payload};
    }
    case 'restore chat prompt': {
      if (state.chatPrompt !== null) {
        return state;
      }
      return {...state, chatPrompt: action.payload};
    }
    default:
      return state;
  }
}

// Exported for stories, which supply a run without the provider's sessionStorage persistence.
export const SeerExplorerChatStateContext = createContext<SeerExplorerChatState>({
  runId: null,
  chatPrompt: null,
  chatStates: {},
});
export const SeerExplorerChatDispatchContext = createContext<Dispatch<ChatStateAction>>(
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
          {/* Wraps every Explorer surface (drawer, sidebar, popped-out window), which the
              deep link listeners need to share what they've already handled. */}
          <SeerExplorerDeepLinkParamProvider>
            {children}
          </SeerExplorerDeepLinkParamProvider>
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
