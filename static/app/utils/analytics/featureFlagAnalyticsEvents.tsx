export type FeatureFlagEventParameters = {
  'flags.cta_dismissed': {area: string; type: string};
  'flags.event_and_suspect_flags_found': {
    numEventFlags: number;
    numSuspectFlags: number;
    numTotalFlags: number;
  };
  'flags.logs-paginated': {
    area: string;
    direction: 'next' | 'prev';
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
  'flags.view-all-clicked': 'Clicked View All Flags',
  'flags.sort_flags': 'Sorted Flags',
  'flags.event_and_suspect_flags_found': 'Number of Event and Suspect Flags',
  'flags.table_rendered': 'Flag Table Rendered',
  'flags.cta_dismissed': 'Flag CTA Dismissed',
  'flags.logs-paginated': 'Feature Flag Logs Paginated',
  'flags.view-setup-sidebar': 'Viewed Feature Flag Onboarding Sidebar',
};
