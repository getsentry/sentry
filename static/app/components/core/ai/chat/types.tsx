// ── Tool Call (Diagram 3) ──────────────────────────────────────────
// Lifecycle of a single tool invocation, instantiated by the queue.

type ToolCallPendingApproval = {
  args: Record<string, unknown>;
  function: string;
  id: string;
  status: 'pending approval';
};

type ToolCallRunning = {
  args: Record<string, unknown>;
  function: string;
  id: string;
  status: 'running';
};

type ToolCallSuccess = {
  args: Record<string, unknown>;
  function: string;
  id: string;
  result: unknown;
  status: 'success';
};

type ToolCallFailed = {
  args: Record<string, unknown>;
  error: string;
  function: string;
  id: string;
  status: 'failed';
};

type ToolCallRejected = {
  args: Record<string, unknown>;
  function: string;
  id: string;
  status: 'rejected';
};

type ToolCallCancelled = {
  args: Record<string, unknown>;
  function: string;
  id: string;
  status: 'cancelled';
};

export type ToolCall =
  | ToolCallPendingApproval
  | ToolCallRunning
  | ToolCallSuccess
  | ToolCallFailed
  | ToolCallRejected
  | ToolCallCancelled;

// ── Tool Queue (Diagram 2) ────────────────────────────────────────
// Orchestrates sequential execution of tool calls within executing_tool.

type ToolQueueProcessing = {
  active: ToolCall;
  completed: ToolCall[];
  pending: ToolCall[];
  status: 'processing';
};

type ToolQueueCompleted = {
  completed: ToolCall[];
  status: 'completed';
};

type ToolQueueAborted = {
  completed: ToolCall[];
  failed: ToolCall;
  skipped: ToolCall[];
  status: 'aborted';
};

type ToolQueueCancelled = {
  completed: ToolCall[];
  skipped: ToolCall[];
  status: 'cancelled';
};

export type ToolQueue =
  | ToolQueueProcessing
  | ToolQueueCompleted
  | ToolQueueAborted
  | ToolQueueCancelled;

// ── Chat Session (Diagram 1) ──────────────────────────────────────
// Top-level lifecycle. Reopened sessions hydrate directly into the
// current server-side state — there is no dedicated re-entry transition.

type ChatSessionInitial = {
  status: 'initial';
};

type ChatSessionThinking = {
  status: 'thinking';
};

type ChatSessionStreaming = {
  status: 'streaming';
};

type ChatSessionExecutingTool = {
  queue: ToolQueue;
  status: 'executing tool';
};

type ChatSessionPendingInput = {
  status: 'pending input';
  queue?: ToolQueue;
};

type ChatSessionInterrupted = {
  status: 'interrupted';
  queue?: ToolQueue;
};

type ChatSessionAwaitingUserInput = {
  input: PendingUserInput;
  status: 'awaiting user input';
};

type ChatSessionEnded = {
  reason: 'abandoned' | 'error';
  status: 'ended';
};

export type ChatSession =
  | ChatSessionInitial
  | ChatSessionThinking
  | ChatSessionStreaming
  | ChatSessionExecutingTool
  | ChatSessionPendingInput
  | ChatSessionInterrupted
  | ChatSessionAwaitingUserInput
  | ChatSessionEnded;

// ── Pending User Input ─────────────────────────────────────────────

type FileChangeApproval = {
  data: Record<string, unknown>;
  id: string;
  type: 'file change approval';
};

type AskUserQuestion = {
  data: Record<string, unknown>;
  id: string;
  type: 'ask user question';
};

export type PendingUserInput = FileChangeApproval | AskUserQuestion;

// ── Messages ───────────────────────────────────────────────────────
// Conversation content. The messages array is append-only, with the
// last assistant message mutable during streaming. Tool execution
// results live on the ToolCall state, not in the messages array.

interface UserMessage {
  actor: 'user';
  content: string;
}

interface AssistantTextMessage {
  actor: 'assistant';
  content: string;
  type: 'text';
  artifacts?: Record<string, unknown>[];
  filePatches?: Record<string, unknown>[];
  todos?: Record<string, unknown>[];
  toolCalls?: ToolCall[];
}

interface AssistantThinkingMessage {
  actor: 'assistant';
  content: string;
  type: 'thinking';
}

export type AssistantMessage = AssistantTextMessage | AssistantThinkingMessage;

export type Message = UserMessage | AssistantMessage;
