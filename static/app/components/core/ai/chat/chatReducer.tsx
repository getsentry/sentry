import type {Message, PendingUserInput, ToolCall, ToolQueue} from './types';

export type ChatState = {
  messages: Message[];
  runId: number | null;
  session:
    | {status: 'initial'}
    | {status: 'thinking'}
    | {status: 'streaming'}
    | {queue: ToolQueue; status: 'executing tool'}
    | {status: 'pending input'; queue?: ToolQueue}
    | {status: 'interrupted'; queue?: ToolQueue}
    | {input: PendingUserInput; status: 'awaiting user input'}
    | {reason: 'abandoned' | 'error'; status: 'ended'};
};

export type UserAction =
  | {content: string; type: 'send message'}
  | {type: 'interrupt'}
  | {response: unknown; type: 'respond to input'};

export type StreamAction =
  | {messageType: 'thinking' | 'text'; type: 'stream start'}
  | {content: string; type: 'stream chunk'}
  | {type: 'stream complete'; toolCalls?: ToolCall[]};

export type ToolAction =
  | {tool: string; type: 'tool call approved'}
  | {tool: string; type: 'tool call rejected'}
  | {result: unknown; tool: string; type: 'tool call succeeded'}
  | {error: string; tool: string; type: 'tool call failed'};

export type SessionAction =
  | {type: 'resume'}
  | {reason: 'abandoned' | 'error'; type: 'end'}
  | {input: PendingUserInput; type: 'await user input'};

export type ChatAction = UserAction | StreamAction | ToolAction | SessionAction;

export const INITIAL_CHAT_STATE: ChatState = {
  session: {status: 'initial'},
  messages: [],
  runId: null,
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  const {session} = state;
  const queue =
    session.status === 'executing tool' && session.queue.status === 'processing'
      ? session.queue
      : null;

  switch (action.type) {
    case 'send message':
      return {
        session: {status: 'thinking'},
        messages: [...state.messages, {actor: 'user', content: action.content}],
      };

    case 'stream start':
      return {
        session: {status: 'streaming'},
        messages: [
          ...state.messages,
          {actor: 'assistant', type: action.messageType, content: ''},
        ],
      };

    case 'stream chunk': {
      const last = state.messages[state.messages.length - 1]!;
      return {
        ...state,
        messages: [
          ...state.messages.slice(0, -1),
          {...last, content: last.content + action.content},
        ],
      };
    }

    case 'stream complete': {
      if (!action.toolCalls?.length) {
        return {...state, session: {status: 'pending input'}};
      }
      const [first, ...rest] = action.toolCalls;
      return {
        session: {
          status: 'executing tool',
          queue: {status: 'processing', active: first!, completed: [], pending: rest},
        },
        messages: [
          ...state.messages.slice(0, -1),
          {...state.messages[state.messages.length - 1]!, toolCalls: action.toolCalls},
        ],
      };
    }

    case 'interrupt': {
      if (session.status !== 'executing tool' || !queue) {
        return {...state, session: {status: 'interrupted'}};
      }
      const active = queue.active;
      const cancelledQueue: ToolQueue = {
        status: 'cancelled',
        completed: [...queue.completed, {...active, status: 'cancelled'}],
        skipped: queue.pending,
      };
      const messages = queue.pending.reduce(
        (msgs, tc) => setToolStatus(msgs, tc.id, {status: 'cancelled'}),
        setToolStatus(state.messages, active.id, {status: 'cancelled'})
      );
      return {session: {status: 'interrupted', queue: cancelledQueue}, messages};
    }

    case 'resume':
      return {...state, session: {status: 'pending input', queue: session.queue}};

    case 'end':
      return {...state, session: {status: 'ended', reason: action.reason}};

    case 'tool call approved':
      return {
        session: {
          status: 'executing tool',
          queue: {...queue!, active: {...queue!.active, status: 'running'}},
        },
        messages: setToolStatus(state.messages, queue!.active.id, {status: 'running'}),
      };

    case 'tool call rejected':
      return {
        session: {
          status: 'pending input',
          queue: {
            status: 'aborted',
            completed: queue!.completed,
            failed: {...queue!.active, status: 'rejected'},
            skipped: queue!.pending,
          },
        },
        messages: setToolStatus(state.messages, queue!.active.id, {status: 'rejected'}),
      };

    case 'tool call succeeded': {
      const succeeded: ToolCall = {
        ...queue!.active,
        status: 'success',
        result: action.result,
      };
      const completed = [...queue!.completed, succeeded];
      const messages = setToolStatus(state.messages, queue!.active.id, {
        status: 'success',
        result: action.result,
      });

      if (queue!.pending.length === 0) {
        return {session: {status: 'thinking'}, messages};
      }
      const [next, ...remaining] = queue!.pending;
      return {
        session: {
          status: 'executing tool',
          queue: {status: 'processing', active: next!, completed, pending: remaining},
        },
        messages,
      };
    }

    case 'tool call failed':
      return {
        session: {
          status: 'pending input',
          queue: {
            status: 'aborted',
            completed: queue!.completed,
            failed: {...queue!.active, status: 'failed', error: action.error},
            skipped: queue!.pending,
          },
        },
        messages: setToolStatus(state.messages, queue!.active.id, {
          status: 'failed',
          error: action.error,
        }),
      };

    case 'await user input':
      return {...state, session: {status: 'awaiting user input', input: action.input}};

    case 'respond to input':
      return {...state, session: {status: 'thinking'}};

    default: {
      const _unreachable: never = action;
      return _unreachable;
    }
  }
}

function setToolStatus(messages: Message[], id: string, patch: Partial<ToolCall>) {
  return messages.map(msg => {
    if (msg.actor !== 'assistant' || msg.type !== 'text' || !msg.toolCalls) {
      return msg;
    }
    const idx = msg.toolCalls.findIndex(tc => tc.id === id);
    if (idx === -1) {
      return msg;
    }
    const toolCalls = [...msg.toolCalls];
    toolCalls[idx] = {...toolCalls[idx]!, ...patch} as ToolCall;
    return {...msg, toolCalls};
  });
}
