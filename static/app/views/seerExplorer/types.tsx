import {z} from 'zod';

import {isFilePatch, type FilePatch} from 'sentry/components/events/autofix/types';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';

/**
 * Where the Seer Explorer sidebar docks. `auto` picks right/bottom based on
 * screen size; `right`/`bottom` force a position. Persisted in localStorage.
 */
export type SeerExplorerSidebarPosition = 'auto' | 'right' | 'bottom';

/**
 * z.enum but forward-compatible: accepts any string at runtime while preserving
 * autocomplete for the known values via the `(string & {})` trick.
 */
function zLooseEnum<T extends string>(values: readonly [T, ...T[]]) {
  return z.enum(values).or(z.custom<string & {}>(val => typeof val === 'string'));
}

// Schemas used by runtime type guards

const explorerFilePatchSchema = z.object({
  diff: z.string(),
  patch: z.custom<FilePatch>(isFilePatch),
  repo_name: z.string(),
});

const repoPRStateSchema = z.object({
  branch_name: z.string().nullable(),
  commit_sha: z.string().nullable(),
  pr_creation_error: z.string().nullable(),
  pr_creation_status: zLooseEnum(['creating', 'completed', 'error']).nullable(),
  pr_id: z.number().nullable(),
  pr_number: z.number().nullable(),
  pr_url: z.string().nullable(),
  repo_name: z.string(),
  title: z.string().nullable(),
});

const artifactSchema = z.object({
  data: z.record(z.string(), z.unknown()).nullable(),
  key: z.string(),
  reason: z.string(),
});

const codingAgentResultSchema = z.object({
  description: z.string(),
  repo_full_name: z.string(),
  repo_provider: z.string(),
  pr_number: z.number().nullable(),
  pr_url: z.string().nullable(),
});

const explorerCodingAgentStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  started_at: z.string(),
  status: zLooseEnum(['pending', 'running', 'completed', 'failed']),
  agent_url: z.string().nullable().optional(),
  results: z.array(codingAgentResultSchema).optional(),
});

// Types

export type ExplorerFilePatch = z.infer<typeof explorerFilePatchSchema>;
export type RepoPRState = z.infer<typeof repoPRStateSchema>;
export type ExplorerCodingAgentState = z.infer<typeof explorerCodingAgentStateSchema>;

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ToolLink {
  kind: string;
  params: Record<string, any>;
}

export type AgentWriteApproval = EmbedOutput<'agentWriteApproval'>;

/**
 * One Sentry API or lib call a Code Mode execute made.
 *
 * `sentry_api_execute` is a single tool name covering every action Code Mode can take, so keying
 * rendering on the tool name (as classic tools do) says nothing useful. Seer instead reports the
 * calls themselves and the client decides how to present them.
 *
 * `path` is the *templated* route (`/api/0/.../{issue_id}/`) — the key a handler matches on, and
 * what makes a link buildable from `path_params`. `parent` nests a lib method's HTTP calls under
 * it; `id` is unique within one execute, so correlation never depends on array position.
 *
 * `body` is a bounded preview, not the payload — records live in the run state row, which is
 * re-serialized on every write and re-downloaded by the poll, so seer caps it and flags when it
 * cut it. No response body is carried: it is arbitrary customer data, it can hold a secret a write
 * hands back, and a row reports the request rather than what came back.
 */
export interface CallRecord {
  id: number;
  kind: 'api' | 'lib';
  /** Bounded slice of the request body, if the call had one. */
  body?: string;
  /** Whether `body` was cut short. */
  body_truncated?: boolean;
  /** Transport-level failure (no HTTP response), e.g. `ConnectError`. */
  error?: string;
  method?: string;
  /** Lib records only. */
  name?: string;
  /**
   * Lib records only: arguments the call was made with, plus values filled in after it returned
   * (e.g. a translated search query). Scalars name the subject at call time; richer values arrive
   * later when the call itself produced them. Untyped wire JSON — narrow at the use site.
   */
  params?: Record<string, unknown>;
  parent?: number | null;
  path?: string;
  path_params?: Record<string, string>;
  /**
   * `path` with its params interpolated and the query string appended — the literal path that was
   * requested. Seer carries the query only here, so this is the whole URL.
   */
  resolved_path?: string;
  /** HTTP status. Absent when the request never completed. */
  status?: number;
  /** Human name for the operation, from the OpenAPI spec. Absent when it has none. */
  title?: string;
}

export interface ToolResult {
  content: string;
  tool_call_function: string;
  tool_call_id: string;
  // MCP-style structured payload carried from seer (codemode-structured-content-only). Code Mode
  // returns every surface it produces here rather than on a bespoke block field, so a renderer
  // resolves a surface from this *and* the legacy field. Keys are optional and additive — absent on
  // old seer responses, in which case only the legacy field is read.
  structuredContent?: {
    agentWriteApproval?: AgentWriteApproval;
    artifacts?: Artifact[];
    calls?: CallRecord[];
    links?: ToolLink[];
    todos?: TodoItem[];
  } | null;
}

export interface ToolCall {
  args: string;
  function: string;
  id?: string | null;
}

interface Message {
  content: string | null;
  role: 'user' | 'assistant' | 'tool_use';
  metadata?: Record<string, string> | null;
  thinking_content?: string | null;
  tool_calls?: ToolCall[] | null;
}

export interface Block {
  id: string;
  message: Message;
  timestamp: string;
  artifacts?: Artifact[];
  file_patches?: ExplorerFilePatch[] | null;
  /**
   * Calls the in-flight Code Mode execute has made so far, written as they happen so a long run
   * shows progress instead of nothing. Superseded by the tool result's `structuredContent.calls`
   * once the execute finishes.
   */
  live_calls?: CallRecord[] | null;
  loading?: boolean;
  merged_file_patches?: ExplorerFilePatch[] | null;
  pr_commit_shas?: Record<string, string> | null;
  todos?: TodoItem[] | null;
  tool_links?: Array<ToolLink | null> | null;
  tool_results?: Array<ToolResult | null> | null;
}

export interface ExplorerSession {
  dateCreated: string;
  id: string;
  lastTriggeredAt: string;
  title: string | null;
}

export interface Artifact<T = Record<string, unknown>> {
  data: T | null;
  key: string;
  reason: string;
}

// Runtime type guards

export function isExplorerFilePatch(value: unknown): value is ExplorerFilePatch {
  return explorerFilePatchSchema.safeParse(value).success;
}

export function isRepoPRState(value: unknown): value is RepoPRState {
  return repoPRStateSchema.safeParse(value).success;
}

export function isArtifact(value: unknown): value is Artifact {
  return artifactSchema.safeParse(value).success;
}

export function isExplorerCodingAgentState(
  value: unknown
): value is ExplorerCodingAgentState {
  return explorerCodingAgentStateSchema.safeParse(value).success;
}

export type PendingUserInput = {
  data: Record<string, any>;
  id: string;
  input_type:
    | 'file_change_approval'
    | 'agent_write_approval'
    | 'ask_user_question'
    | 'reauth_monitoring_provider';
};

export interface ReauthMonitoringProviderData {
  auth_method: 'oauth' | 'pat';
  identity_id: number;
  provider_key: string;
}

export type SeerExplorerRunId = number | string;

export type SeerExplorerResponse = {
  session: {
    blocks: Block[];
    status: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
    updated_at: string;
    owner_user_id?: number | null;
    pending_user_input?: PendingUserInput | null;
    repo_pr_states?: Record<string, RepoPRState>;
  } | null;
  sentry_run_id?: string | null;
};
