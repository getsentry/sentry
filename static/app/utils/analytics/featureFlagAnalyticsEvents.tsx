export type FeatureFlagEventParameters = {
  'flags.event_and_suspect_flags_found': {
    numEventFlags: number;
    numSuspectFlags: number;
    numTotalFlags: number;
  };
  'flags.sort-flags': {sortMethod: string};
  'flags.view-all-clicked': {};
};

export type FeatureFlagEventKey = keyof FeatureFlagEventParameters;

export const featureFlagEventMap: Record<FeatureFlagEventKey, string | null> = {
  'flags.view-all-clicked': 'Clicked View All Flags',
  'flags.sort-flags': 'Sorted Flags',
  'flags.event_and_suspect_flags_found': 'Number of Event and Suspect Flags',
};
