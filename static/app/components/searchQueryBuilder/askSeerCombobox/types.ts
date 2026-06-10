import type {ChartType} from 'sentry/views/insights/common/components/chart';

export interface SeerRawResponseItem {
  end: string | null;
  group_by: string[];
  mode: string;
  query: string;
  sort: string;
  start: string | null;
  stats_period: string;
  visualization?: Array<{chart_type?: number; y_axes?: string[]}>;
}

export interface SeerRawResponse {
  responses: SeerRawResponseItem[];
  unsupported_reason: string | null;
  // Projects Seer actually scoped the query to — a superset of the projects we
  // sent when it broadens scope. `null`/absent when there's no expansion.
  project_ids?: number[] | null;
}

export interface NoneOfTheseItem {
  key: 'none-of-these';
  label: string;
}

interface AskSeerSearchItem<S extends string> {
  key: S extends 'none-of-these' ? never : S;
}

export type AskSeerSearchItems<T> = (AskSeerSearchItem<string> & T) | NoneOfTheseItem;

export interface QueryTokensProps {
  end?: string | null;
  /**
   * Projects the agent broadened the query to, when it expanded scope beyond
   * the user's selection. Set only when there is an actual expansion; drives
   * the "Projects" chip and the projects applied when the suggestion is chosen.
   */
  expandedProjectIds?: number[];
  groupBys?: string[];
  query?: string;
  sort?: string;
  start?: string | null;
  statsPeriod?: string;
  visualizations?: Array<{yAxes: string[]; chartType?: ChartType}>;
}

export interface AskSeerSearchQuery extends QueryTokensProps {
  end: string | null;
  groupBys: string[];
  mode: string;
  query: string;
  sort: string;
  start: string | null;
  statsPeriod: string;
  visualizations: Array<{yAxes: string[]; chartType?: ChartType}>;
}

/**
 * Represents a step in the search agent execution.
 */
export interface AskSeerStep {
  key: string;
}

/**
 * Response from the /search-agent/start/ endpoint.
 */
export interface AskSeerStartResponse {
  run_id: number | null;
  sentry_run_id?: string;
}

/**
 * Session data returned from the /search-agent/state/ endpoint.
 */
interface AskSeerSession<T extends QueryTokensProps> {
  completed_steps: AskSeerStep[];
  created_at: string;
  current_step: AskSeerStep | null;
  natural_language_query: string;
  org_id: number;
  org_slug: string;
  run_id: number;
  status: 'processing' | 'completed' | 'error';
  strategy: string;
  updated_at: string;
  final_query?: string | null;
  final_response?: T | null;
  unsupported_reason?: string | null;
}

/**
 * Full response from the /search-agent/state/ endpoint.
 */
export interface AskSeerPollingResponse<T extends QueryTokensProps> {
  session: AskSeerSession<T> | null;
}
