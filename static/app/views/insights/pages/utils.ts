import type {Organization} from 'sentry/types/organization';
import {DOMAIN_VIEW_MODULES} from 'sentry/views/insights/pages/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  MODULE_FEATURE_MAP,
  MODULE_FEATURE_VISIBLE_MAP,
  MODULES_CONSIDERED_NEW,
} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

export const isModuleEnabled = (module: ModuleName, organization: Organization) =>
  MODULE_FEATURE_MAP[module].every(f => organization.features.includes(f));

export const isModuleVisible = (module: ModuleName, organization: Organization) =>
  MODULE_FEATURE_VISIBLE_MAP[module].every(f => organization.features.includes(f));

export const isModuleConsideredNew = (module: ModuleName) =>
  MODULES_CONSIDERED_NEW.has(module);

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
