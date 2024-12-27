export type FeatureFlagEventParameters = {
  'flags.cta_dismissed': {type: string};
  'flags.cta_setup_button_clicked': {};
  'flags.event_and_suspect_flags_found': {
    numEventFlags: number;
    numSuspectFlags: number;
    numTotalFlags: number;
  };
  'flags.sort_flags': {sortMethod: string};
  'flags.table_rendered': {
    numFlags: number;
  };
  'flags.view-all-clicked': {};
  'flags.view-setup-sidebar': {};
};

export type FeatureFlagEventKey = keyof FeatureFlagEventParameters;

export const featureFlagEventMap: Record<FeatureFlagEventKey, string | null> = {
  'flags.view-all-clicked': 'Clicked View All Flags',
  'flags.sort_flags': 'Sorted Flags',
  'flags.event_and_suspect_flags_found': 'Number of Event and Suspect Flags',
  'flags.table_rendered': 'Flag Table Rendered',
  'flags.cta_setup_button_clicked': 'Flag CTA Setup Button Clicked',
  'flags.cta_dismissed': 'Flag CTA Dismissed',
  'flags.view-setup-sidebar': 'Viewed Feature Flag Onboarding Sidebar',
};
