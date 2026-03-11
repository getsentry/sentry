import {isFilePatch, type FilePatch} from 'sentry/components/events/autofix/types';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ExplorerFilePatch {
  diff: string;
  patch: FilePatch;
  repo_name: string;
}

export function isExplorerFilePatch(value: unknown): value is ExplorerFilePatch {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    isFilePatch(obj.patch) &&
    typeof obj.repo_name === 'string' &&
    typeof obj.diff === 'string'
  );
}

export interface RepoPRState {
  branch_name: string | null;
  commit_sha: string | null;
  pr_creation_error: string | null;
  pr_creation_status: 'creating' | 'completed' | 'error' | null;
  pr_id: number | null;
  pr_number: number | null;
  pr_url: string | null;
  repo_name: string;
  title: string | null;
}

export function isRepoPRState(value: unknown): value is RepoPRState {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.repo_name === 'string' &&
    (obj.branch_name === null || typeof obj.branch_name === 'string') &&
    (obj.commit_sha === null || typeof obj.commit_sha === 'string') &&
    (obj.pr_creation_error === null || typeof obj.pr_creation_error === 'string') &&
    (obj.pr_creation_status === null || typeof obj.pr_creation_status === 'string') &&
    (obj.pr_id === null || typeof obj.pr_id === 'number') &&
    (obj.pr_number === null || typeof obj.pr_number === 'number') &&
    (obj.pr_url === null || typeof obj.pr_url === 'string') &&
    (obj.title === null || typeof obj.title === 'string')
  );
}

export interface Artifact<T = Record<string, unknown>> {
  data: T | null;
  key: string;
  reason: string;
}

export function isArtifact(value: unknown): value is Artifact {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return 'data' in obj && typeof obj.key === 'string' && typeof obj.reason === 'string';
}

export interface Block {
  id: string;
  message: Message;
  timestamp: string;
  artifacts?: Artifact[];
  file_patches?: ExplorerFilePatch[]; // Incremental patches (for approval)
  loading?: boolean;
  merged_file_patches?: ExplorerFilePatch[]; // Merged patches (original → current) for files touched in this block
  pr_commit_shas?: Record<string, string>;
  todos?: TodoItem[];
  tool_links?: Array<ToolLink | null>;
  tool_results?: Array<ToolResult | null>;
}

export interface ToolLink {
  kind: string;
  params: Record<string, any>;
}

export interface ToolResult {
  content: string;
  tool_call_function: string;
  tool_call_id: string;
}

export interface ToolCall {
  args: string;
  function: string;
  id: string;
}

interface Message {
  content: string;
  role: 'user' | 'assistant' | 'tool_use';
  thinking_content?: string;
  tool_calls?: ToolCall[];
}

export type PanelSize = 'max' | 'med';

export interface ExplorerSession {
  created_at: string; // ISO date string
  last_triggered_at: string;
  run_id: number;
  title: string; // ISO date string
}

/**
 * Result from a coding agent (e.g., Cursor).
 */
interface CodingAgentResult {
  description: string;
  repo_full_name: string;
  repo_provider: string;
  branch_name?: string;
  pr_url?: string;
}

/**
 * State of a coding agent launched from an Explorer run.
 */
export interface ExplorerCodingAgentState {
  id: string;
  name: string;
  provider: string;
  started_at: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agent_url?: string;
  results?: CodingAgentResult[];
}
