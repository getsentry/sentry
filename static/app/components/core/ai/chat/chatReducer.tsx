import type {ChatSession, Message, ToolCall, ToolQueue} from './types';

export type ChatState = {
  messages: Message[];
  session: ChatSession;
};

export type ChatAction =
  | {content: string; type: 'send message'}
  | {messageType: 'thinking' | 'text'; type: 'stream start'}
  | {content: string; type: 'stream chunk'}
  | {type: 'stream complete'; toolCalls?: ToolCall[]}
  | {type: 'interrupt'}
  | {type: 'resume'}
  | {reason: 'abandoned' | 'error'; type: 'end'}
  | {toolCallId: string; type: 'tool approve'}
  | {toolCallId: string; type: 'tool reject'}
  | {result: unknown; toolCallId: string; type: 'tool success'}
  | {error: string; toolCallId: string; type: 'tool failed'};

export const INITIAL_CHAT_STATE: ChatState = {
  session: {status: 'initial'},
  messages: [],
};

function reduceToolQueue(queue: ToolQueue, action: ChatAction): ToolQueue {
  switch (action.type) {
    case 'tool approve': {
      if (queue.status !== 'processing' || queue.active.status !== 'pending approval') {
        return queue;
      }
      return {
        ...queue,
        active: {...queue.active, status: 'running'},
      };
    }

    case 'tool reject': {
      if (queue.status !== 'processing' || queue.active.status !== 'pending approval') {
        return queue;
      }
      const rejected: ToolCall = {...queue.active, status: 'rejected'};
      return {
        status: 'aborted',
        completed: queue.completed,
        failed: rejected,
        skipped: queue.pending,
      };
    }

    case 'tool success': {
      if (queue.status !== 'processing' || queue.active.status !== 'running') {
        return queue;
      }
      const succeeded: ToolCall = {
        ...queue.active,
        status: 'success',
        result: action.result,
      };
      const completed = [...queue.completed, succeeded];

      if (queue.pending.length === 0) {
        return {status: 'completed', completed};
      }

      const [next, ...remaining] = queue.pending;
      return {
        status: 'processing',
        active: next!,
        completed,
        pending: remaining,
      };
    }

    case 'tool failed': {
      if (queue.status !== 'processing' || queue.active.status !== 'running') {
        return queue;
      }
      const failed: ToolCall = {
        ...queue.active,
        status: 'failed',
        error: action.error,
      };
      return {
        status: 'aborted',
        completed: queue.completed,
        failed,
        skipped: queue.pending,
      };
    }

    case 'interrupt': {
      if (queue.status !== 'processing') {
        return queue;
      }
      const cancelled: ToolCall = {...queue.active, status: 'cancelled'};
      return {
        status: 'cancelled',
        completed: [...queue.completed, cancelled],
        skipped: queue.pending,
      };
    }

    default:
      return queue;
  }
}

function createToolQueue(toolCalls: ToolCall[]): ToolQueue {
  const [first, ...rest] = toolCalls;
  return {
    status: 'processing',
    active: first!,
    completed: [],
    pending: rest,
  };
}

function updateLastMessage(messages: Message[], content: string): Message[] {
  if (messages.length === 0) {
    return messages;
  }
  const last = messages[messages.length - 1]!;
  return [...messages.slice(0, -1), {...last, content: last.content + content}];
}

function attachToolCallsToLastMessage(
  messages: Message[],
  toolCalls: ToolCall[]
): Message[] {
  if (messages.length === 0) {
    return messages;
  }
  const last = messages[messages.length - 1]!;
  if (last.actor !== 'assistant' || last.type !== 'text') {
    return messages;
  }
  return [...messages.slice(0, -1), {...last, toolCalls}];
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'send message': {
      if (
        state.session.status !== 'initial' &&
        state.session.status !== 'pending input'
      ) {
        return state;
      }
      const userMessage: Message = {actor: 'user', content: action.content};
      return {
        session: {status: 'thinking'},
        messages: [...state.messages, userMessage],
      };
    }

    case 'stream start': {
      if (state.session.status !== 'thinking' && state.session.status !== 'streaming') {
        return state;
      }
      const assistantMessage: Message = {
        actor: 'assistant',
        type: action.messageType,
        content: '',
      };
      return {
        session: {status: 'streaming'},
        messages: [...state.messages, assistantMessage],
      };
    }

    case 'stream chunk': {
      if (state.session.status !== 'streaming') {
        return state;
      }
      return {
        ...state,
        messages: updateLastMessage(state.messages, action.content),
      };
    }

    case 'stream complete': {
      if (state.session.status !== 'streaming') {
        return state;
      }
      if (action.toolCalls && action.toolCalls.length > 0) {
        return {
          session: {
            status: 'executing tool',
            queue: createToolQueue(action.toolCalls),
          },
          messages: attachToolCallsToLastMessage(state.messages, action.toolCalls),
        };
      }
      return {
        session: {status: 'pending input'},
        messages: state.messages,
      };
    }

    case 'interrupt': {
      const s = state.session.status;
      if (s !== 'thinking' && s !== 'streaming' && s !== 'executing tool') {
        return state;
      }
      if (s === 'executing tool') {
        const queue = reduceToolQueue(state.session.queue, action);
        return {
          session: {status: 'interrupted', queue},
          messages: state.messages,
        };
      }
      return {
        session: {status: 'interrupted'},
        messages: state.messages,
      };
    }

    case 'resume': {
      if (state.session.status !== 'interrupted') {
        return state;
      }
      return {
        session: {status: 'pending input', queue: state.session.queue},
        messages: state.messages,
      };
    }

    case 'end': {
      if (state.session.status !== 'pending input') {
        return state;
      }
      return {
        session: {status: 'ended', reason: action.reason},
        messages: state.messages,
      };
    }

    case 'tool approve':
    case 'tool reject':
    case 'tool success':
    case 'tool failed': {
      if (state.session.status !== 'executing tool') {
        return state;
      }
      const queue = reduceToolQueue(state.session.queue, action);
      if (queue.status === 'completed') {
        return {
          session: {status: 'thinking'},
          messages: state.messages,
        };
      }
      if (queue.status === 'aborted') {
        return {
          session: {status: 'pending input', queue},
          messages: state.messages,
        };
      }
      return {
        session: {status: 'executing tool', queue},
        messages: state.messages,
      };
    }

    default:
      return state;
  }
}
