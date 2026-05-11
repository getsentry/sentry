import {z} from 'zod';

import {isFilePatch, type FilePatch} from 'sentry/components/events/autofix/types';

/**
 * z.enum but forward-compatible: accepts any string at runtime while preserving
 * autocomplete for the known values via the `(string & {})` trick.
 */
function zLooseEnum<T extends string>(values: readonly [T, ...T[]]) {
  return z.enum(values).or(z.custom<string & {}>(val => typeof val === 'string'));
}

// Schema definitions
const todoItemSchema = z.object({
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
});

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

const toolLinkSchema = z.object({
  kind: z.string(),
  params: z.record(z.string(), z.any()),
});

const toolResultSchema = z.object({
  content: z.string(),
  tool_call_function: z.string(),
  tool_call_id: z.string(),
});

const toolCallSchema = z.object({
  args: z.string(),
  function: z.string(),
  id: z.string().nullable().optional(),
});

const messageSchema = z.object({
  content: z.string().nullable(),
  role: z.enum(['user', 'assistant', 'tool_use']),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  thinking_content: z.string().nullable().optional(),
  tool_calls: z.array(toolCallSchema).nullable().optional(),
});

export const blockSchema = z.object({
  id: z.string(),
  message: messageSchema,
  timestamp: z.string(),
  artifacts: z.array(artifactSchema).optional(),
  file_patches: z.array(explorerFilePatchSchema).nullable().optional(),
  loading: z.boolean().optional(),
  merged_file_patches: z.array(explorerFilePatchSchema).nullable().optional(),
  pr_commit_shas: z.record(z.string(), z.string()).nullable().optional(),
  todos: z.array(todoItemSchema).nullable().optional(),
  tool_links: z.array(toolLinkSchema.nullable()).nullable().optional(),
  tool_results: z.array(toolResultSchema.nullable()).nullable().optional(),
});

export const explorerSessionSchema = z.object({
  created_at: z.string(),
  last_triggered_at: z.string(),
  run_id: z.number(),
  title: z.string(),
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
export type TodoItem = z.infer<typeof todoItemSchema>;
export type RepoPRState = z.infer<typeof repoPRStateSchema>;

export type ToolLink = z.infer<typeof toolLinkSchema>;
export type ToolResult = z.infer<typeof toolResultSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;

export type Block = z.infer<typeof blockSchema>;

export type ExplorerFilePatch = z.infer<typeof explorerFilePatchSchema>;
export type ExplorerSession = z.infer<typeof explorerSessionSchema>;
export type ExplorerCodingAgentState = z.infer<typeof explorerCodingAgentStateSchema>;

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
