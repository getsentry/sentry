import {z} from 'zod';

import {isFilePatch, type FilePatch} from 'sentry/components/events/autofix/types';

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
  pr_url: z.string().nullable().optional(),
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
