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
