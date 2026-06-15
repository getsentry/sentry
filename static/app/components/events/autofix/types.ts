import {t} from 'sentry/locale';
import {isArrayOf} from 'sentry/types/utils';

export enum DiffFileType {
  ADDED = 'A',
  MODIFIED = 'M',
  DELETED = 'D',
}

function isDiffFileType(value: unknown): value is DiffFileType {
  return (
    value === DiffFileType.ADDED ||
    value === DiffFileType.MODIFIED ||
    value === DiffFileType.DELETED
  );
}

export enum DiffLineType {
  ADDED = '+',
  REMOVED = '-',
  CONTEXT = ' ',
}

function isDiffLineType(value: unknown): value is DiffLineType {
  return (
    value === DiffLineType.ADDED ||
    value === DiffLineType.REMOVED ||
    value === DiffLineType.CONTEXT
  );
}

export enum AutofixStoppingPoint {
  ROOT_CAUSE = 'root_cause',
  SOLUTION = 'solution',
  CODE_CHANGES = 'code_changes',
  OPEN_PR = 'open_pr',
}

export enum CodingAgentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum CodingAgentProvider {
  CURSOR_BACKGROUND_AGENT = 'cursor_background_agent',
  CLAUDE_CODE_AGENT = 'claude_code_agent',
  GITHUB_COPILOT_AGENT = 'github_copilot_agent',
}

export function getResultButtonLabel(url: string | null | undefined): string {
  if (url?.includes('/tree/')) {
    return t('View Branch');
  }
  return t('View Pull Request');
}

export type FilePatch = {
  added: number;
  hunks: Hunk[];
  path: string;
  removed: number;
  source_file: string;
  target_file: string;
  type: DiffFileType;
};

export function isFilePatch(value: unknown): value is FilePatch {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.added === 'number' &&
    isArrayOf(obj.hunks, isHunk) &&
    typeof obj.path === 'string' &&
    typeof obj.removed === 'number' &&
    typeof obj.source_file === 'string' &&
    typeof obj.target_file === 'string' &&
    isDiffFileType(obj.type)
  );
}

type Hunk = {
  lines: DiffLine[];
  section_header: string;
  source_length: number;
  source_start: number;
  target_length: number;
  target_start: number;
};

function isHunk(value: unknown): value is Hunk {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    isArrayOf(obj.lines, isDiffLine) &&
    typeof obj.section_header === 'string' &&
    typeof obj.source_length === 'number' &&
    typeof obj.source_start === 'number' &&
    typeof obj.target_length === 'number' &&
    typeof obj.target_start === 'number'
  );
}

export type DiffLine = {
  diff_line_no: number | null;
  line_type: DiffLineType;
  source_line_no: number | null;
  target_line_no: number | null;
  value: string;
};

function isDiffLine(value: unknown): value is DiffLine {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    (typeof obj.diff_line_no === 'number' || obj.diff_line_no === null) &&
    isDiffLineType(obj.line_type) &&
    (typeof obj.source_line_no === 'number' || obj.source_line_no === null) &&
    (typeof obj.target_line_no === 'number' || obj.target_line_no === null) &&
    typeof obj.value === 'string'
  );
}

export interface AutofixRepoDefinition {
  name: string;
  owner: string;
  provider: string;
}

interface BranchOverride {
  branch_name: string;
  tag_name: string;
  tag_value: string;
}

export interface SeerRepoDefinition {
  external_id: string;
  name: string;
  owner: string;
  provider: string;
  base_commit_sha?: string;
  branch_name?: string;
  branch_overrides?: BranchOverride[];
  instructions?: string;
  integration_id?: string;
  organization_id?: number | string; // TODO: should be string
  provider_raw?: string;
}

export interface SeerAutomationHandoffConfiguration {
  handoff_point: 'root_cause';
  integration_id: number;
  target: CodingAgentProvider;
  auto_create_pr?: boolean;
}

export const PROVIDER_TO_HANDOFF_TARGET: Record<
  string,
  SeerAutomationHandoffConfiguration['target']
> = {
  cursor: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
  claude_code: CodingAgentProvider.CLAUDE_CODE_AGENT,
  github_copilot: CodingAgentProvider.GITHUB_COPILOT_AGENT,
};

export interface ProjectSeerPreferences {
  repositories: SeerRepoDefinition[];
  automated_run_stopping_point?: 'root_cause' | 'solution' | 'code_changes' | 'open_pr';
  automation_handoff?: SeerAutomationHandoffConfiguration;
}

export const AUTOFIX_TTL_IN_DAYS = 30;

export function getCodingAgentName(provider: string | undefined): string {
  switch (provider) {
    case CodingAgentProvider.CURSOR_BACKGROUND_AGENT:
      return t('Cursor Cloud Agent');
    case CodingAgentProvider.CLAUDE_CODE_AGENT:
      return t('Claude Agent');
    case CodingAgentProvider.GITHUB_COPILOT_AGENT:
      return t('GitHub Copilot');
    default:
      return t('Coding Agent');
  }
}
