export type FeatureFlagEventParameters = {
  'flags.sort-flags': {sortMethod: string};
  'flags.view-all-clicked': {};
};

export type FeatureFlagEventKey = keyof FeatureFlagEventParameters;

export const featureFlagEventMap: Record<FeatureFlagEventKey, string | null> = {
  'flags.view-all-clicked': 'Clicked View All Flags',
  'flags.sort-flags': 'Sorted Flags',
};
