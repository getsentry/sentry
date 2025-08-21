import type {Member} from 'sentry/types/organization';

export interface IncidentComponent {
  created_at: string;
  id: number;
  name: string;
  organization_id: number;
  status: string;
  type: string;
  updated_at: string;
  description?: string;
  status_page_component_id?: string;
}

export interface IncidentCaseTemplate {
  id: string;
  name: string;
  case_handle?: string;
  case_lead_title?: string;
  channel_config?: Record<string, any>;
  channel_provider?: string;
  retro_config?: Record<string, any>;
  retro_provider?: string;
  schedule_config?: Record<string, any>;
  schedule_provider?: string;
  severity_handle?: string;
  status_page_config?: Record<string, any>;
  status_page_provider?: string;
  task_config?: Record<string, any>;
  task_provider?: string;
  update_frequency_minutes?: number;
}

export interface IncidentCase {
  case_lead: Member;
  id: number;
  resolved_at: string;
  severity: number;
  started_at: string;
  status: string;
  template: IncidentCaseTemplate;
  title: string;
  affected_components?: IncidentComponent[];
  channel_record?: Record<string, any>;
  description?: string;
  retro_record?: Record<string, any>;
  schedule_record?: Record<string, any>;
  status_page_record?: Record<string, any>;
  task_record?: Record<string, any>;
}

export type IncidentToolKey = 'schedule' | 'task' | 'channel' | 'status_page' | 'retro';
