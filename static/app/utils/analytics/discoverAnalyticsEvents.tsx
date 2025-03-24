import type {EventOrGroupType} from 'sentry/types/event';
import type {ContextType} from 'sentry/views/discover/table/quickContext/utils';

type SaveQueryParams = {
  fields?: readonly string[];
  projects?: readonly number[];
  query?: string;
};

export type SaveQueryEventParameters = {
  'discover_v2.delete_query_failed': SaveQueryParams & {error: string};
  'discover_v2.delete_query_request': SaveQueryParams;
  'discover_v2.delete_query_success': SaveQueryParams;
  'discover_v2.save_existing_query_failed': SaveQueryParams & {error: string};
  'discover_v2.save_existing_query_request': SaveQueryParams;
  'discover_v2.save_existing_query_success': SaveQueryParams;
  'discover_v2.save_new_query_failed': SaveQueryParams & {error: string};
  'discover_v2.save_new_query_request': SaveQueryParams;
  'discover_v2.save_new_query_success': SaveQueryParams;
  'discover_v2.update_query_failed': SaveQueryParams & {error: string};
  'discover_v2.update_query_name_request': SaveQueryParams;
  'discover_v2.update_query_name_successs': SaveQueryParams;
  'discover_v2.update_query_request': SaveQueryParams;
  'discover_v2.update_query_success': SaveQueryParams;
};

export type DiscoverEventParameters = SaveQueryEventParameters & {
  'discover_search.failed': {
    error: string;
    search_source: string;
    search_type: string;
  };
  'discover_search.success': {
    has_results: boolean;
    search_source: string;
    search_type: string;
  };
  'discover_v2.add_equation': Record<string, unknown>;
  'discover_v2.build_new_query': Record<string, unknown>;
  'discover_v2.change_sort': {sort: string};
  'discover_v2.column_editor.open': Record<string, unknown>;
  'discover_v2.create_alert_clicked': {status: string};
  'discover_v2.prebuilt_query_click': {query_name?: string};
  'discover_v2.quick_context_add_column': {column: string};
  'discover_v2.quick_context_header_copy': {clipBoardTitle: string};
  'discover_v2.quick_context_hover_contexts': {
    contextType: ContextType;
    eventType?: EventOrGroupType;
  };
  'discover_v2.quick_context_update_query': {queryKey: string};
  'discover_v2.remove_default': {source: 'homepage' | 'prebuilt-query' | 'saved-query'};
  'discover_v2.results.cellaction': {action: string};
  'discover_v2.results.download_csv': Record<string, unknown>;
  'discover_v2.results.drilldown': Record<string, unknown>;
  'discover_v2.results.toggle_tag_facets': Record<string, unknown>;
  'discover_v2.save_existing_query_failed': SaveQueryParams & {error: string};
  'discover_v2.saved_query_click': Record<string, unknown>;
  'discover_v2.set_as_default': {
    source: 'homepage' | 'prebuilt-query' | 'saved-query' | 'context-menu';
    // For breaking down context-menu events
    type?: 'prebuilt-query' | 'saved-query';
  };
  'discover_v2.tour.advance': {duration: number; step: number};
  'discover_v2.tour.close': {duration: number; step: number};
  'discover_v2.tour.start': Record<string, unknown>;
  'discover_v2.update_columns': Record<string, unknown>;
  'discover_v2.view_saved_queries': Record<string, unknown>;
  'discover_v2.y_axis_change': {y_axis_value: string[]};
};

export type DiscoverEventKey = keyof DiscoverEventParameters;

export const discoverEventMap: Record<DiscoverEventKey, string | null> = {
  'discover_v2.add_equation': 'Dicoverv2: Equation added',
  'discover_v2.build_new_query': 'Discoverv2: Build a new Discover Query',
  'discover_v2.change_sort': 'Discoverv2: Sort By Changed',
  'discover_v2.prebuilt_query_click': 'Discoverv2: Click a pre-built query',
  'discover_v2.tour.advance': 'Discoverv2: Tour Advance',
  'discover_v2.tour.close': 'Discoverv2: Tour Close',
  'discover_v2.tour.start': 'Discoverv2: Tour Start',
  'discover_v2.saved_query_click': 'Discoverv2: Click a saved query',
  'discover_v2.view_saved_queries': 'Discoverv2: Click Saved Queries button',
  'discover_v2.set_as_default': 'Discoverv2: Click set as default',
  'discover_v2.remove_default': 'Discoverv2: Click remove default',
  'discover_v2.results.toggle_tag_facets': 'Discoverv2: Toggle Tag Facets',
  'discover_v2.quick_context_hover_contexts': 'Discover2: Hover over Quick Context',
  'discover_v2.quick_context_add_column': 'Discover2: Add column from Quick Context',
  'discover_v2.quick_context_header_copy':
    'Discover2: Copy value from Quick Context header',
  'discover_v2.y_axis_change': "Discoverv2: Change chart's y axis",
  'discover_v2.save_new_query_request': 'Discoverv2: Request to save a new query',
  'discover_v2.save_new_query_success': 'Discoverv2: Successfully saved a new query',
  'discover_v2.save_new_query_failed': 'Discoverv2: Failed to save a new query',
  'discover_v2.save_existing_query_request':
    'Discoverv2: Request to save a saved query as a new query',
  'discover_v2.save_existing_query_success':
    'Discoverv2: Successfully saved a saved query as a new query',
  'discover_v2.save_existing_query_failed':
    'Discoverv2: Failed to save a saved query as a new query',
  'discover_v2.update_query_failed': 'Discoverv2: Failed to update a saved query',
  'discover_v2.update_query_request': 'Discoverv2: Request to update a saved query',
  'discover_v2.update_query_success': 'Discoverv2: Successfully updated a saved query',
  'discover_v2.quick_context_update_query': 'Discoverv2: Update query from Quick Context',
  'discover_v2.update_query_name_request':
    "Discoverv2: Request to update a saved query's name",
  'discover_v2.update_query_name_successs':
    "Discoverv2: Successfully updated a saved query's name",
  'discover_v2.delete_query_success': 'Discoverv2: Successfully deleted a saved query',
  'discover_v2.delete_query_failed': 'Discoverv2: Failed to delete a saved query',
  'discover_v2.delete_query_request': 'Discoverv2: Request to delete a saved query',
  'discover_v2.create_alert_clicked': 'Discoverv2: Create alert clicked',
  'discover_v2.column_editor.open': 'Discoverv2: Open column editor',
  'discover_v2.results.download_csv': 'Discoverv2: Download CSV',
  'discover_v2.results.cellaction': 'Discoverv2: Cell Action Clicked',
  'discover_v2.results.drilldown': 'Discoverv2: Click aggregate drilldown',
  'discover_v2.update_columns': 'Discoverv2: Update columns',
  'discover_search.failed': 'Discover Search: Failed',
  'discover_search.success': 'Discover Search: Succeeded',
};
