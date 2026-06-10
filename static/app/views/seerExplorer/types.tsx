import type {FilePatch} from 'sentry/components/events/autofix/types';

export interface ExplorerFilePatch {
  diff: string;
  patch: FilePatch;
  repo_name: string;
}

export interface RepoPRState {
  branch_name: string | null;
  commit_sha: string | null;
  pr_creation_error: string | null;
  pr_creation_status: 'creating' | 'completed' | 'error' | (string & {}) | null;
  pr_id: number | null;
  pr_number: number | null;
  pr_url: string | null;
  repo_name: string;
  title: string | null;
}

interface CodingAgentResult {
  description: string;
  repo_full_name: string;
  repo_provider: string;
  pr_url?: string | null;
}

export interface ExplorerCodingAgentState {
  id: string;
  name: string;
  provider: string;
  started_at: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | (string & {});
  agent_url?: string | null;
  results?: CodingAgentResult[];
}

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
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
  loading?: boolean;
  merged_file_patches?: ExplorerFilePatch[] | null;
  pr_commit_shas?: Record<string, string> | null;
  todos?: TodoItem[] | null;
  tool_links?: Array<ToolLink | null> | null;
  tool_results?: Array<ToolResult | null> | null;
}

export interface ExplorerSession {
  created_at: string;
  last_triggered_at: string;
  run_id: number;
  title: string;
}

export interface Artifact<T = Record<string, unknown>> {
  data: T | null;
  key: string;
  reason: string;
}

export type PendingUserInput = {
  data: Record<string, any>;
  id: string;
  input_type: 'file_change_approval' | 'ask_user_question';
};

export type SeerExplorerResponse = {
  session: {
    blocks: Block[];
    status: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
    updated_at: string;
    owner_user_id?: number | null;
    pending_user_input?: PendingUserInput | null;
    repo_pr_states?: Record<string, RepoPRState>;
    run_id?: number;
  } | null;
};
