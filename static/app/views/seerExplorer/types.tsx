import type {FilePatch} from 'sentry/components/events/autofix/types';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ExplorerFilePatch {
  patch: FilePatch;
  repo_name: string;
}

export interface RepoPRState {
  repo_name: string;
  branch_name?: string;
  commit_sha?: string;
  pr_creation_error?: string;
  pr_creation_status?: 'creating' | 'completed' | 'error';
  pr_id?: number;
  pr_number?: number;
  pr_url?: string;
  title?: string;
}

export interface Artifact {
  data: Record<string, unknown> | null;
  key: string;
  reason: string;
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

export interface ExplorerPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export interface ExplorerSession {
  created_at: string; // ISO date string
  last_triggered_at: string;
  run_id: number;
  title: string; // ISO date string
}
