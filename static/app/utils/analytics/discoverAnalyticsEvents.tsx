import {EventOrGroupType} from 'sentry/types';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';

type SaveQueryParams = {
  fields?: readonly string[];
  projects?: readonly number[];
  query?: string;
};

export type SaveQueryEventParameters = {
  'discover_v2.save_existing_query_failed': SaveQueryParams & {error: string};
  'discover_v2.save_existing_query_request': SaveQueryParams;
  'discover_v2.save_existing_query_success': SaveQueryParams;
  'discover_v2.save_new_query_failed': SaveQueryParams & {error: string};
  'discover_v2.save_new_query_request': SaveQueryParams;
  'discover_v2.save_new_query_success': SaveQueryParams;
  'discover_v2.update_query_failed': SaveQueryParams & {error: string};
  'discover_v2.update_query_request': SaveQueryParams;
  'discover_v2.update_query_success': SaveQueryParams;
};

export type DiscoverEventParameters = SaveQueryEventParameters & {
  'discover_v2.add_equation': {};
  'discover_v2.build_new_query': {};
  'discover_v2.change_sort': {sort: string};
  'discover_v2.facet_map.clicked': {tag: string};
  'discover_v2.prebuilt_query_click': {query_name?: string};
  'discover_v2.processed_baseline_toggle.clicked': {toggled: string};
  'discover_v2.quick_context_add_column': {column: string};
  'discover_v2.quick_context_header_copy': {clipBoardTitle: string};
  'discover_v2.quick_context_hover_contexts': {
    contextType: ContextType;
    eventType?: EventOrGroupType;
  };
  'discover_v2.quick_context_update_query': {queryKey: string};
  'discover_v2.remove_default': {source: 'homepage' | 'prebuilt-query' | 'saved-query'};
  'discover_v2.results.toggle_tag_facets': {};
  'discover_v2.save_existing_query_failed': SaveQueryParams & {error: string};
  'discover_v2.saved_query_click': {};
  'discover_v2.set_as_default': {
    source: 'homepage' | 'prebuilt-query' | 'saved-query' | 'context-menu';
    // For breaking down context-menu events
    type?: 'prebuilt-query' | 'saved-query';
  };
  'discover_v2.tour.advance': {duration: number; step: number};
  'discover_v2.tour.close': {duration: number; step: number};
  'discover_v2.tour.start': {};
  'discover_v2.view_saved_queries': {};
  'discover_v2.y_axis_change': {y_axis_value: string[]};
  'discover_views.add_to_dashboard.confirm': {};
  'discover_views.add_to_dashboard.modal_open': {saved_query: boolean};
};

export type DiscoverEventKey = keyof DiscoverEventParameters;

export const discoverEventMap: Record<DiscoverEventKey, string | null> = {
  'discover_v2.add_equation': 'Dicoverv2: Equation added',
  'discover_v2.build_new_query': 'Discoverv2: Build a new Discover Query',
  'discover_v2.change_sort': 'Discoverv2: Sort By Changed',
  'discover_v2.facet_map.clicked': 'Discoverv2: Clicked on a tag on the facet map',
  'discover_v2.prebuilt_query_click': 'Discoverv2: Click a pre-built query',
  'discover_v2.processed_baseline_toggle.clicked':
    'Discoverv2: Clicked processed baseline toggle',
  'discover_v2.tour.advance': 'Discoverv2: Tour Advance',
  'discover_v2.tour.close': 'Discoverv2: Tour Close',
  'discover_v2.tour.start': 'Discoverv2: Tour Start',
  'discover_v2.saved_query_click': 'Discoverv2: Click a saved query',
  'discover_v2.view_saved_queries': 'Discoverv2: Click Saved Queries button',
  'discover_v2.set_as_default': 'Discoverv2: Click set as default',
  'discover_v2.remove_default': 'Discoverv2: Click remove default',
  'discover_v2.results.toggle_tag_facets': 'Discoverv2: Toggle Tag Facets',
  'discover_views.add_to_dashboard.modal_open':
    'Discover2: Add to Dashboard modal opened',
  'discover_views.add_to_dashboard.confirm':
    'Discover2: Add to Dashboard modal form submitted',
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
};
