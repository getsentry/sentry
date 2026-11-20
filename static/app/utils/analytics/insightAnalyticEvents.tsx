import type {DomainView} from 'sentry/views/insights/pages/useFilters';

export type InsightEventParameters = {
  'insight.page_loads.agent_models': {has_ever_sent_data: boolean; view: DomainView};
  'insight.page_loads.agent_tools': {has_ever_sent_data: boolean; view: DomainView};
  'insight.page_loads.assets': {has_ever_sent_data: boolean; view: DomainView};
  'insight.page_loads.mcp_prompts': {has_ever_sent_data: boolean; view: DomainView};
  'insight.page_loads.mcp_resources': {has_ever_sent_data: boolean; view: DomainView};
  'insight.page_loads.mcp_tools': {has_ever_sent_data: boolean; view: DomainView};
  'insight.page_loads.vital': {has_ever_sent_data: boolean; view: DomainView};
  'insight.vital.select_navigation_type': {navigation_types: string};
  'insight.vital.vital_sidebar_opened': {vital: string};
  'insights.create_alert': {referrer: string};
  'insights.open_in_explore': {referrer: string};
  'insights.page_loads.overview': {domain: DomainView | undefined; platforms: string[]};
};

export type InsightEventKey = keyof InsightEventParameters;

export const insightEventMap: Record<InsightEventKey, string | null> = {
  'insights.page_loads.overview': 'Insights: Overview Page Load',
  'insight.page_loads.agent_models': 'Insights: Agent Models Page Load',
  'insight.page_loads.agent_tools': 'Insights: Agent Tools Page Load',
  'insight.page_loads.mcp_prompts': 'Insights: MCP Prompts Page Load',
  'insight.page_loads.mcp_resources': 'Insights: MCP Resources Page Load',
  'insight.page_loads.mcp_tools': 'Insights: MCP Tools Page Load',
  'insight.page_loads.assets': 'Insights: Assets Page Load',
  'insight.page_loads.vital': 'Insights: Vital Page Load',
  'insight.vital.select_navigation_type':
    'Insights: Vitals - select navigation type buckets',
  'insight.vital.vital_sidebar_opened': 'Insights: Web Vitals - vital sidebar opened',
  'insights.open_in_explore': 'Insights: Open in Explore',
  'insights.create_alert': 'Insights: Create Alert',
};
