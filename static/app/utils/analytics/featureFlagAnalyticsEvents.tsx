export type FeatureFlagEventParameters = {
  'flags.cta_dismissed': {area: string; type: string};
  'flags.cta_rendered': {area: string};
  'flags.drawer_details_clicked': Record<string, unknown>;
  'flags.drawer_rendered': {
    numFlags: number;
  };
  'flags.event_and_suspect_flags_found': {
    numEventFlags: number;
    numSuspectFlags: number;
    numTotalFlags: number;
  };
  'flags.logs-paginated': {
    area: string;
    direction: 'next' | 'prev';
  };
  'flags.setup_sidebar_provider_selected': {
    provider: string;
    platform?: string;
  };
  'flags.sort_flags': {sortMethod: string};
  'flags.table_rendered': {
    numFlags: number;
    orgSlug: string;
    projectSlug: string;
  };
  'flags.view-all-clicked': Record<string, unknown>;
  'flags.view-setup-sidebar': {
    area: string;
  };
};

export type FeatureFlagEventKey = keyof FeatureFlagEventParameters;

export const featureFlagEventMap: Record<FeatureFlagEventKey, string | null> = {
  'flags.cta_dismissed': 'Flag CTA Dismissed',
  'flags.cta_rendered': 'Flag CTA Rendered',
  'flags.drawer_details_clicked': 'Feature Flag Drawer Details Clicked',
  'flags.drawer_rendered': 'Feature Flag Drawer Rendered',
  'flags.event_and_suspect_flags_found': 'Number of Event and Suspect Flags',
  'flags.logs-paginated': 'Feature Flag Logs Paginated',
  'flags.setup_sidebar_provider_selected':
    'Selected Provider in Feature Flag Onboarding Sidebar',
  'flags.sort_flags': 'Sorted Flags',
  'flags.table_rendered': 'Flag Table Rendered',
  'flags.view-all-clicked': 'Clicked View All Flags',
  'flags.view-setup-sidebar': 'Viewed Feature Flag Onboarding Sidebar',
};
