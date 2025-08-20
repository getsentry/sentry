export interface IncidentCase {
  created_at: string;
  id: number;
  organization_id: number;
  severity: string;
  status: string;
  title: string;
  updated_at: string;
  description?: string;
}

export interface IncidentComponent {
  created_at: string;
  id: number;
  name: string;
  organization_id: number;
  status: string;
  type: string;
  updated_at: string;
  description?: string;
}

export interface IncidentCaseTemplate {
  created_at: string;
  id: number;
  name: string;
  organization_id: number;
  severity_levels: string[];
  updated_at: string;
  auto_assign_to?: string;
  description?: string;
}

export type IncidentToolKey = 'schedule' | 'task' | 'channel' | 'status_page' | 'retro';
