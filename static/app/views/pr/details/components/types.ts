import type {Group} from 'sentry/types/group';

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
