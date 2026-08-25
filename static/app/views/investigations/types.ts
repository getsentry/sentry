import type {ToolResult} from 'sentry/views/seerExplorer/types';

export type InvestigationListItem = {
  blockCount: number;
  createdBy: string | null;
  dateCreated: string;
  dateUpdated: string;
  id: string;
  isFavorited: boolean;
  sourceType: string;
  status: string;
  title: string;
  version: number;
};

// Expand this response type as the detail UI begins consuming additional fields.
// The complete server response is retained at runtime in the query cache.
export type InvestigationBlock = {
  config: Record<string, unknown>;
  content: string;
  createdBy: string | null;
  currentExecution: InvestigationBlockExecution | null;
  dependencies: string[];
  display: Record<string, unknown>;
  generatedContent: string;
  generationPrompt: string;
  id: string;
  kind: InvestigationBlockKind;
  lastEditedBy: string | null;
  output: unknown;
  outputStatus: InvestigationExecutionStatus;
  parameterKeys: string[];
  position: number;
  staleAt: string | null;
  title: string;
  version: number;
};

export type InvestigationBlockKind = 'query' | 'text';

export type InvestigationBlockExecutionStart = {
  id: string;
  status: InvestigationExecutionStatus;
};

export type InvestigationExecutionStatus =
  | 'notRun'
  | 'available'
  | 'restricted'
  | 'pending'
  | 'running'
  | 'awaiting_input'
  | 'stopping'
  | 'completed'
  | 'failed'
  | 'cancelled';

type InvestigationBlockExecution = {
  completedAt: string | null;
  error: {code?: string; message?: string} | null;
  id: string;
  startedAt: string | null;
  status: InvestigationExecutionStatus;
  executor?: string;
  schemaVersion?: number;
};

export type InvestigationTranscriptBlock = {
  artifacts: Array<{
    data: Record<string, unknown> | null;
    key: string;
    reason: string;
  }>;
  id: string;
  loading: boolean;
  message: {
    content: string | null;
    role: 'user' | 'assistant' | 'tool_use';
    metadata?: Record<string, string> | null;
    thinking_content?: string | null;
    tool_calls?: Array<{
      args: string;
      function: string;
      id?: string | null;
    }> | null;
  };
  timestamp: string;
  toolLinks: Array<{
    kind: string;
    params: Record<string, unknown>;
  } | null> | null;
  toolResults: Array<{
    content: string;
    tool_call_function: string;
    tool_call_id: string;
    structuredContent?: ToolResult['structuredContent'];
  } | null> | null;
};

type InvestigationPendingUserInput = {
  data: Record<string, unknown>;
  id: string;
  input_type: 'ask_user_question';
};

export type InvestigationExecutionDetail = {
  blocks: InvestigationTranscriptBlock[];
  error: {code?: string; message?: string} | null;
  id: string;
  partialMarkdown: string | null;
  pendingUserInput: InvestigationPendingUserInput | null;
  status: InvestigationExecutionStatus;
  transcriptTruncated: boolean;
};

export type InvestigationQueryOutput = {
  chart: Record<string, unknown> | null;
  chartUnavailableReason: string | null;
  isEmpty: boolean;
  preferredView: 'chart' | 'table';
  queryLinks: Array<{kind: string; params: Record<string, unknown>}>;
  schemaVersion: number;
  tableMarkdown: string;
};

export type InvestigationDetail = InvestigationListItem & {
  blocks?: InvestigationBlock[];
  filters?: Record<string, unknown>;
  parameters?: unknown[];
  projectIds?: number[];
  source?: Record<string, unknown>;
  template?: {key: string; version: number} | null;
  titleGeneration?: {status: string | null};
};

export type MetricOpenPeriodInvestigationSource = {
  ref: {
    groupId: string;
    openPeriodId: string;
  };
  type: 'metric_open_period';
};

export type InvestigationCandidate =
  | {status: 'investigate'}
  | {status: 'unavailable'}
  | {investigationId: string; status: 'view'};
