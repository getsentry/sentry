export type FeatureFlagEventParameters = {
  'flags.cta_dismissed': {surface: string; type: string};
  'flags.event_and_suspect_flags_found': {
    numEventFlags: number;
    numSuspectFlags: number;
    numTotalFlags: number;
  };
  'flags.logs-paginated': {
    direction: 'next' | 'prev';
    surface: string;
  };
  'flags.sort_flags': {sortMethod: string};
  'flags.table_rendered': {
    numFlags: number;
    orgSlug: string;
    projectSlug: string;
  };
  'flags.view-all-clicked': Record<string, unknown>;
  'flags.view-setup-sidebar': {
    surface: string;
  };
};

export type FeatureFlagEventKey = keyof FeatureFlagEventParameters;

export const featureFlagEventMap: Record<FeatureFlagEventKey, string | null> = {
  'flags.cta_dismissed': 'Flag CTA Dismissed',
  'flags.event_and_suspect_flags_found': 'Number of Event and Suspect Flags',
  'flags.logs-paginated': 'Feature Flag Logs Paginated',
  'flags.sort_flags': 'Sorted Flags',
  'flags.table_rendered': 'Flag Table Rendered',
  'flags.view-all-clicked': 'Clicked View All Flags',
  'flags.view-setup-sidebar': 'Viewed Feature Flag Onboarding Sidebar',
};
