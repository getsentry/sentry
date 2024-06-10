export type InsightEventParameters = {
  'insight.app_start.select_start_type': {type: string};
  'insight.app_start.spans.filter_by_device_class': {filter: string};
  'insight.app_start.spans.filter_by_operation': {filter: string};
  'insight.app_start.spans.toggle_sample_type': {type: string};
  'insight.asset.filter_by_blocking': {filter: string};
  // Don't specify filter because page filter are arbitrary values
  'insight.asset.filter_by_page': {};
  'insight.asset.filter_by_type': {filter: string};
  'insight.general.chart_zoom': {chart_name: string; source: string};
  'insight.general.search': {query: string; source: string};
  'insight.general.search_query_result': {
    error: string;
    has_data: boolean;
    query: string;
    source: string;
  };
  'insight.general.select_action_value': {source: string; value: string};
  // Don't specify domain because domains are arbitrary values
  'insight.general.select_domain_value': {source: string};
  'insight.general.table_paginate': {direction: string; source: string};
  'insight.general.table_sort': {
    direction: string;
    field: string;
    source: string;
  };
  'insight.page_loads.ai': {has_data: boolean};
  'insight.page_loads.app_start': {has_data: boolean};
  'insight.page_loads.assets': {has_data: boolean};
  'insight.page_loads.cache': {has_data: boolean};
  'insight.page_loads.db': {has_data: boolean};
  'insight.page_loads.http': {has_data: boolean};
  'insight.page_loads.queue': {has_data: boolean};
  'insight.page_loads.screen_load': {has_data: boolean};
  'insight.page_loads.vital': {has_data: boolean};
  'insight.screen_load.spans.filter_by_device_class': {filter: string};
  'insight.screen_load.spans.filter_by_operation': {filter: string};
  'insight.vital.open_vital_sidebar': {vital: string};
  'insight.vital.overview.click_aggregate_spans_tab': {type: string};
  'insight.vital.overview.open_transaction_summary': {};
  'insight.vital.overview.open_view_waterfall': {};
  'insight.vital.overview.toggle_data_type': {type: string};
};

export type InsightEventKey = keyof InsightEventParameters;

export const insightEventMap: Record<InsightEventKey, string | null> = {
  'insight.page_loads.ai': 'Insights: AI Page Load',
  'insight.page_loads.app_start': 'Insights: App Start Page Load',
  'insight.page_loads.assets': 'Insights: Assets Page Load',
  'insight.page_loads.cache': 'Insights: Cache Page Load',
  'insight.page_loads.db': 'Insights: DB Page Load',
  'insight.page_loads.http': 'Insights: HTTP Page Load',
  'insight.page_loads.queue': 'Insights: Queue Page Load',
  'insight.page_loads.screen_load': 'Insights: Screen Load Page Load',
  'insight.page_loads.vital': 'Insights: Vital Page Load',
  'insight.app_start.select_start_type': 'Insights: App Start - select app start type',
  'insight.app_start.spans.filter_by_device_class':
    'Insights: App Start - filter device class',
  'insight.app_start.spans.filter_by_operation': 'Insights: App Start - filter operation',
  'insight.app_start.spans.toggle_sample_type':
    'Insights: App Start - toggle sample type',
  'insight.asset.filter_by_blocking': 'Insights: Assets - filter blocking',
  'insight.asset.filter_by_page': 'Insights: Assets - filter page',
  'insight.asset.filter_by_type': 'Insights: Assets - filter asset type',
  'insight.general.chart_zoom': 'Insights: chart zoom',
  'insight.general.search': 'Insights: search in modules',
  'insight.general.search_query_result': 'Insights: search result in modules',
  'insight.general.select_action_value': 'Insights: select actionSelector dropdown value',
  'insight.general.select_domain_value': 'Insights: select domainSelector dropdown value',
  'insight.general.table_paginate': 'Insights: paginate',
  'insight.general.table_sort': 'Insights: sort table',
  'insight.screen_load.spans.filter_by_device_class':
    'Insights: Screen Loads - filter device class',
  'insight.screen_load.spans.filter_by_operation':
    'Insights: Screen Loads - filter operation',
  'insight.vital.open_vital_sidebar': 'Insights: Web Vitals - open vital sidebar',
  'insight.vital.overview.click_aggregate_spans_tab':
    'Insights: Web Vitals - click aggregate spans tab',
  'insight.vital.overview.open_transaction_summary':
    'Insights: Web Vitals - open transaction summary',
  'insight.vital.overview.open_view_waterfall':
    'Insights: Web Vitals - open in waterfall view',
  'insight.vital.overview.toggle_data_type': 'Insights: Web Vitals - toggle data type',
};
