import type {Organization} from 'sentry/types/organization';
import {DOMAIN_VIEW_MODULES} from 'sentry/views/insights/pages/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  MODULE_FEATURE_MAP,
  MODULE_HIDDEN_WHEN_FEAUTRE_DISABLED,
} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

export const isModuleEnabled = (module: ModuleName, organization: Organization) => {
  const moduleFeatures: string[] | undefined = MODULE_FEATURE_MAP[module];
  if (!moduleFeatures) {
    return false;
  }
  return moduleFeatures.every(feature => organization.features.includes(feature));
};

export const isModuleHidden = (module: ModuleName, organization: Organization) =>
  MODULE_HIDDEN_WHEN_FEAUTRE_DISABLED.includes(module) &&
  !isModuleEnabled(module, organization);

export const getModuleView = (module: ModuleName): DomainView => {
  if (DOMAIN_VIEW_MODULES.backend.includes(module)) {
    return 'backend';
  }
  if (DOMAIN_VIEW_MODULES.frontend.includes(module)) {
    return 'frontend';
  }
  if (DOMAIN_VIEW_MODULES.mobile.includes(module)) {
    return 'mobile';
  }
  if (DOMAIN_VIEW_MODULES.ai.includes(module)) {
    return 'ai';
  }
  return 'backend';
};
