import {useContext, useMemo} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useOrganization from 'sentry/utils/useOrganization';
import {ProjectContext} from 'sentry/views/projects/projectContext';

type AllFeatures = {
  configFeatures: ReadonlyArray<string>;
  organization: ReadonlyArray<string>;
  project: ReadonlyArray<string>;
};

type FeatureFlag = string;

/**
 * Hook to check feature flags for the current context (user, project, organization)
 */
export function useFeatureFlags() {
  const allFeatures = useAllFeatures();

  return {
    has(feature: FeatureFlag) {
      return hasFeature(feature, allFeatures);
    },
    hasAll(features: FeatureFlag[]) {
      return features.every(feature => hasFeature(feature, allFeatures));
    },
    hasOne(features: FeatureFlag[]) {
      return features.some(feature => hasFeature(feature, allFeatures));
    },
  };
}

function useAllFeatures(): AllFeatures {
  const organization = useOrganization();
  const project = useContext(ProjectContext);
  const config = useLegacyStore(ConfigStore);

  return useMemo(
    () => ({
      configFeatures: config.features ? Array.from(config.features) : [],
      organization: organization?.features ?? [],
      project: project?.features ?? [],
    }),
    [organization, project, config]
  );
}

function hasFeature(feature: string, features: AllFeatures): boolean {
  const {configFeatures, organization, project} = features;

  // Check config store first as this overrides features scoped to org or
  // project contexts.
  if (configFeatures.includes(feature)) {
    return true;
  }

  const shouldMatchOnlyProject = feature.match(/^projects:(.+)/)?.[1];
  if (shouldMatchOnlyProject) {
    return project.includes(shouldMatchOnlyProject);
  }

  const shouldMatchOnlyOrg = feature.match(/^organizations:(.+)/)?.[1];
  if (shouldMatchOnlyOrg) {
    return organization.includes(shouldMatchOnlyOrg);
  }

  // default, check all feature arrays
  return organization.includes(feature) || project.includes(feature);
}
