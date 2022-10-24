export type DiscoverEventParameters = {
  'discover_v2.add_equation': {};
  'discover_v2.build_new_query': {};
  'discover_v2.change_sort': {sort: string};
  'discover_v2.facet_map.clicked': {tag: string};
  'discover_v2.prebuilt_query_click': {query_name?: string};
  'discover_v2.processed_baseline_toggle.clicked': {toggled: string};
  'discover_v2.remove_default': {source: 'homepage' | 'prebuilt-query' | 'saved-query'};
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
  'discover_views.add_to_dashboard.modal_open':
    'Discover2: Add to Dashboard modal opened',
  'discover_views.add_to_dashboard.confirm':
    'Discover2: Add to Dashboard modal form submitted',
};
