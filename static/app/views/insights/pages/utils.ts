import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {BACKEND_PLATFORMS} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_PLATFORMS} from 'sentry/views/insights/pages/frontend/settings';
import {MOBILE_PLATFORMS} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_MODULES} from 'sentry/views/insights/pages/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  MODULE_FEATURE_MAP,
  MODULE_FEATURE_VISIBLE_MAP,
  MODULES_CONSIDERED_BETA,
  MODULES_CONSIDERED_NEW,
} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

export const isModuleEnabled = (module: ModuleName, organization: Organization) =>
  MODULE_FEATURE_MAP[module].every(f => organization.features.includes(f));

export const isModuleVisible = (module: ModuleName, organization: Organization) =>
  MODULE_FEATURE_VISIBLE_MAP[module].every(f => organization.features.includes(f));

export const isModuleConsideredNew = (module: ModuleName) =>
  MODULES_CONSIDERED_NEW.has(module);

export const isModuleInBeta = (module: ModuleName) => MODULES_CONSIDERED_BETA.has(module);

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
  if (DOMAIN_VIEW_MODULES['ai-agents'].includes(module)) {
    return 'ai-agents';
  }
  if (DOMAIN_VIEW_MODULES.mcp.includes(module)) {
    return 'mcp';
  }
  return 'backend';
};

export const categorizeProjects = (projects: Project[]) => {
  const otherProjects: Project[] = [];
  const backendProjects: Project[] = [];
  const frontendProjects: Project[] = [];
  const mobileProjects: Project[] = [];

  projects.forEach(project => {
    if (project?.platform && FRONTEND_PLATFORMS.includes(project.platform)) {
      frontendProjects.push(project);
    } else if (project?.platform && MOBILE_PLATFORMS.includes(project.platform)) {
      mobileProjects.push(project);
    } else if (project?.platform && BACKEND_PLATFORMS.includes(project.platform)) {
      backendProjects.push(project);
    } else {
      otherProjects.push(project);
    }
  });

  return {otherProjects, frontendProjects, mobileProjects, backendProjects};
};
