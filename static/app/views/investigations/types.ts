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
  summary: string | null;
  summaryDescription: string | null;
  title: string;
  version: number;
  mode?: 'agentic' | 'manual' | 'template';
  orchestration?: InvestigationOrchestrationSummary | null;
  titleGeneration?: {
    status: 'pending' | 'running' | 'completed' | 'failed' | null;
  };
};

export type InvestigationOrchestrationSummary = {
  heartbeatAt: string | null;
  notebookRevision: number;
  phase: string;
  status: string;
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
  reportProvenance?: {
    orchestrationRunId: string;
    producingSeerRunId: string | null;
    reportRevision: number;
  } | null;
  stableAgentKey?: string | null;
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
};

export type InvestigationTitleGeneration = {
  preview: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | null;
};

type InvestigationOrchestrationOpenString<T extends string> = T | (string & {});

export type InvestigationOrchestrationPhase = InvestigationOrchestrationOpenString<
  | 'intake'
  | 'broad_scan'
  | 'planning'
  | 'investigating'
  | 'judging'
  | 'reporting'
  | 'metadata'
  | 'completed'
  | 'failed'
  | 'cancelled'
>;

export type InvestigationOrchestrationStatus = InvestigationOrchestrationOpenString<
  'pending' | 'processing' | 'awaiting_input' | 'completed' | 'failed' | 'cancelled'
>;

export type InvestigationOrchestrationWorkStatus = InvestigationOrchestrationOpenString<
  | 'not_started'
  | 'queued'
  | 'running'
  | 'blocked'
  | 'reauth_required'
  | 'stalled'
  | 'completed'
  | 'failed'
  | 'cancelled'
>;

export type InvestigationHypothesisStatus = InvestigationOrchestrationOpenString<
  | 'pending'
  | 'investigating'
  | 'supported'
  | 'refuted'
  | 'inconclusive'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'cancelled'
>;

export type InvestigationOrchestrationError = {
  code: string;
  message: string;
  retryable: boolean;
  occurredAt?: string;
  requestId?: string;
  source?: string | null;
};

export type InvestigationToolActivity = {
  id: string;
  kind: InvestigationOrchestrationOpenString<'api' | 'library' | 'step' | 'tool'>;
  status: InvestigationOrchestrationOpenString<
    'queued' | 'running' | 'completed' | 'failed'
  >;
  title: string;
};

export type InvestigationOrchestrationEvidence = {
  data: Record<string, unknown>;
  id: string;
  kind: InvestigationOrchestrationOpenString<
    | 'issue'
    | 'event'
    | 'trace'
    | 'profile'
    | 'replay'
    | 'query'
    | 'chart'
    | 'release'
    | 'monitor'
    | 'external'
    | 'other'
  >;
  title: string;
  reference?: string | null;
  summary?: string | null;
  url?: string | null;
};

export type InvestigationVerificationStep = {
  error: InvestigationOrchestrationError | null;
  evidence: InvestigationOrchestrationEvidence[];
  id: string;
  method: string;
  objective: string;
  order: number;
  result: string | null;
  status: InvestigationOrchestrationWorkStatus;
  title: string;
};

export type InvestigationAgentVerdict = {
  confidence: number;
  rationale: string;
  refutingEvidenceIds: string[];
  remainingGaps: string[];
  supportingEvidenceIds: string[];
  verdict: InvestigationOrchestrationOpenString<'supported' | 'refuted' | 'inconclusive'>;
};

export type InvestigationHypothesis = {
  confidence: number | null;
  decisionSource: InvestigationOrchestrationOpenString<'none' | 'agent' | 'user'>;
  effectiveStatus: InvestigationHypothesisStatus;
  error: InvestigationOrchestrationError | null;
  evidence: InvestigationOrchestrationEvidence[];
  id: string;
  order: number;
  rationale: string;
  statement: string;
  status: InvestigationOrchestrationWorkStatus;
  verificationSteps: InvestigationVerificationStep[];
  agentVerdict?: InvestigationAgentVerdict | null;
  attempt?: number;
  automaticRetryCount?: number;
  heartbeatAt?: string | null;
  investigatorRunId?: number | null;
  toolActivity?: InvestigationToolActivity[];
};

export type InvestigationOrchestrationReport = {
  currentBlockKey: string | null;
  error: InvestigationOrchestrationError | null;
  includedHypothesisIds: string[];
  metadata: {
    error: InvestigationOrchestrationError | null;
    status: InvestigationOrchestrationOpenString<
      'not_started' | 'generating' | 'completed' | 'failed'
    >;
    summary: string | null;
    summaryDescription: string | null;
    title: string | null;
  };
  notebookRevision: number;
  primaryHypothesisId: string | null;
  revision: number;
  status: InvestigationOrchestrationOpenString<
    | 'not_started'
    | 'waiting'
    | 'composing'
    | 'completed'
    | 'partial_failed'
    | 'failed'
    | 'cancelled'
  >;
  automaticRetryCount?: number;
  currentBlockStatus?: InvestigationOrchestrationWorkStatus | null;
  currentBlockToolActivity?: InvestigationToolActivity[];
  heartbeatAt?: string | null;
  suggestedHypotheses?: Array<{
    statement: string;
    rationale?: string | null;
  }>;
};

export type InvestigationOrchestration = {
  broadScan: {
    error: InvestigationOrchestrationError | null;
    status: InvestigationOrchestrationWorkStatus;
    summary: string | null;
    attempt?: number;
    automaticRetryCount?: number;
    heartbeatAt?: string | null;
    runId?: number | string | null;
    toolActivity?: InvestigationToolActivity[];
  };
  errors: InvestigationOrchestrationError[];
  generation: number;
  heartbeatAt: string | null;
  hypotheses: InvestigationHypothesis[];
  investigationId: string;
  notebookRevision: number;
  phase: InvestigationOrchestrationPhase;
  report: InvestigationOrchestrationReport;
  runId: string | null;
  sourceType: InvestigationOrchestrationOpenString<'manual' | 'breached_metric'>;
  status: InvestigationOrchestrationStatus;
  updatedAt: string;
  workflowVersion: number;
  pendingInput?: {
    missingFields: Array<'prompt' | 'time_range'>;
    prompt: string;
  } | null;
  steeringIntents?: Array<{
    createdAt: string;
    id: string;
    instruction: string;
    requestId: string;
    target: InvestigationOrchestrationOpenString<
      'workflow' | 'hypothesis' | 'report' | 'block'
    >;
    targetId: string | null;
  }>;
};

export type InvestigationOrchestrationCommand =
  | {
      type: 'provide_input';
      prompt?: string;
      timeRange?: {end: string; start: string};
    }
  | {
      statement: string;
      type: 'add_hypothesis';
      rationale?: string | null;
    }
  | {
      disposition: 'accepted' | 'rejected' | null;
      hypothesisId: string;
      type: 'set_hypothesis_disposition';
    }
  | {
      instruction: string;
      target: 'workflow' | 'hypothesis' | 'report' | 'block';
      type: 'steer';
      targetId?: string | null;
    }
  | {
      target: 'run' | 'hypothesis' | 'report';
      type: 'retry';
      targetId?: string | null;
    }
  | {
      type: 'cancel';
      reason?: string | null;
    };

export type InvestigationOrchestrationCommandVariables = {
  command: InvestigationOrchestrationCommand;
  expectedWorkflowVersion: number;
  requestId: string;
};

export type InvestigationOrchestrationCommandResponse = {
  accepted: boolean;
  duplicate: boolean;
  projection: InvestigationOrchestration;
  requestId: string;
  runId: string | null;
  workflowVersion: number;
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
  | {
      investigationId: string;
      status: 'view';
      orchestration?: InvestigationOrchestrationSummary | null;
    };
