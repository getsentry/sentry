export interface Repository {
  full_name: string;
  name: string;
  private: boolean;
}

export interface User {
  avatar_url: string;
  html_url: string;
  login: string;
}

export interface PullRequest {
  base: {
    ref: string;
    sha: string;
  };
  body: string;
  created_at: string;
  draft: boolean;
  head: {
    ref: string;
    sha: string;
  };
  html_url: string;
  id: number;
  number: number;
  repository: Repository;
  state: 'open' | 'closed';
  title: string;
  updated_at: string;
  user: User;
  assignees?: User[];
  labels?: Array<{
    color: string;
    name: string;
  }>;
  merged_at?: string;
  requested_reviewers?: User[];
}
