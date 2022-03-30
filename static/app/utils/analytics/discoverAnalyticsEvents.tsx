export type DiscoverEventParameters = {
  'discover_views.add_to_dashboard.confirm': {};
  'discover_views.add_to_dashboard.modal_open': {saved_query: boolean};
};

export type DiscoverEventKey = keyof DiscoverEventParameters;

// if value is null, send to Reload only
export const discoverEventMap: Record<DiscoverEventKey, string | null> = {
  'discover_views.add_to_dashboard.modal_open':
    'Discover2: Add to Dashboard modal opened',
  'discover_views.add_to_dashboard.confirm':
    'Discover2: Add to Dashboard modal form submitted',
};
