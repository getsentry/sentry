import type {ChartType} from 'sentry/views/insights/common/components/chart';

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
  groupBys?: string[];
  query?: string;
  sort?: string;
  start?: string | null;
  statsPeriod?: string;
  visualizations?: Array<{chartType: ChartType; yAxes: string[]}>;
}

export interface AskSeerSearchQuery extends QueryTokensProps {
  end: string | null;
  groupBys: string[];
  mode: string;
  query: string;
  sort: string;
  start: string | null;
  statsPeriod: string;
  visualizations: Array<{chartType: ChartType; yAxes: string[]}>;
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
  run_id: number;
}

/**
 * Session data returned from the /search-agent/state/ endpoint.
 */
export interface AskSeerSession<T extends QueryTokensProps> {
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
