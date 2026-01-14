interface AssignedEntity {
  email: string | null;
  id: string;
  name: string;
  type: string;
}

export interface ClusterSummary {
  assignedTo: AssignedEntity[];
  cluster_avg_similarity: number | null;
  // unused
  cluster_id: number;
  cluster_min_similarity: number | null;
  // unused
  cluster_size: number | null;
  // unused
  description: string;
  fixability_score: number | null;
  group_ids: number[];
  issue_titles: string[];
  project_ids: number[];
  summary: string | null;
  tags: string[];
  title: string;
  code_area_tags?: string[];
  error_type?: string;
  error_type_tags?: string[];
  explorer_run_id?: number;
  impact?: string;
  location?: string;
  service_tags?: string[];
}

export interface TopIssuesResponse {
  data: ClusterSummary[];
  last_updated?: string;
}
