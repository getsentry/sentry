import {useMemo} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

/**
 * This accepts a list of feature flags which all must exist for the function to return true.
 */
export function useHasFeatures(features: string[]): boolean {
  const organization = useOrganization();
  const featureSet = useMemo(
    () => new Set(organization.features),
    [organization.features]
  );
  const hasAllFeatures = features.every(feature => featureSet.has(feature));
  return hasAllFeatures;
}
