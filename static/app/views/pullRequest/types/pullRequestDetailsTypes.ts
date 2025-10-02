import type {Group} from 'sentry/types/group';

export type PullRequestState = 'open' | 'closed' | 'merged' | 'draft';
type PullRequestFileStatus = 'added' | 'modified' | 'removed' | 'renamed';

interface PullRequestAuthor {
  avatar_url: string | null;
  display_name: string | null;
  id: string | null;
  username: string | null;
}

interface PullRequestDetails {
  additions: number;
  author: PullRequestAuthor;
  changed_files_count: number;
  closed_at: string | null;
  commits_count: number;
  created_at: string | null;
  deletions: number;
  description: string | null;
  id: string | null;
  merged_at: string | null;
  number: number;
  source_branch: string | null;
  state: PullRequestState;
  target_branch: string | null;
  title: string | null;
  updated_at: string | null;
  url: string | null;
}

interface PullRequestFileChange {
  additions: number;
  changes: number;
  deletions: number;
  filename: string;
  patch: string | null;
  previous_filename: string | null;
  sha: string | null;
  status: PullRequestFileStatus;
}

export interface PullRequestDetailsSuccessResponse {
  files: PullRequestFileChange[];
  pull_request: PullRequestDetails;
}

export interface PullRequestDetailsErrorResponse {
  error: string;
  message: string;
  details?: string;
}

export type PullRequestDetailsResponse =
  | PullRequestDetailsSuccessResponse
  | PullRequestDetailsErrorResponse;

export interface PRFileData {
  additions: number;
  changes: number;
  deletions: number;
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  blob_url?: string;
  patch?: string;
  raw_url?: string;
}

export interface PRDetails {
  body: string;
  created_at: string;
  html_url: string;
  merged_at: string | null;
  state: 'open' | 'closed';
  title: string;
  updated_at: string;
  user: {
    avatar_url: string;
    html_url: string;
    login: string;
  };
}

export interface PRData {
  data: {
    performance?: {
      files: string[];
      message: string;
    };
    releases?: {
      files: string[];
      message: string;
    };
  };
  files: string[];
  statsPeriod: string;
  pr_details?: PRDetails;
  pr_files?: PRFileData[];
  pr_number?: string;
  repo?: string;
}

export interface PRIssuesData {
  issues: Group[];
  meta: {
    query: string;
    has_more?: boolean;
    searches_performed?: number;
    total_count?: number;
  };
  pagination: {
    next?: string;
    prev?: string;
  };
}

export interface GitHubUser {
  avatar_url: string;
  html_url: string;
  id: number;
  login: string;
  type: string;
}

export interface GitHubComment {
  body: string;
  created_at: string;
  html_url: string;
  id: number;
  updated_at: string;
  url: string;
  user: GitHubUser;
  diff_hunk?: string;
  line?: number;
  original_line?: number;
  path?: string;
  position?: number;
  side?: 'LEFT' | 'RIGHT';
}

export interface PRCommentsData {
  file_comments: Record<string, GitHubComment[]>;
  general_comments: GitHubComment[];
}
