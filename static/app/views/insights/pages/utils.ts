import type {ModuleName} from 'webpack-cli';

import type {Organization} from 'sentry/types/organization';
import {MODULE_FEATURE_MAP} from 'sentry/views/insights/settings';

export const isModuleEnabled = (module: ModuleName, organization: Organization) => {
  const moduleFeatures: string[] | undefined = MODULE_FEATURE_MAP[module];
  if (!moduleFeatures) {
    return false;
  }
  return moduleFeatures.every(feature => organization.features.includes(feature));
};
