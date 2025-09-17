import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';

import type {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';

export interface InitializeDataSettings {
  features?: string[];
  project?: any; // TODO(k-fish): Fix this project type.
  projects?: Project[];
  query?: Record<string, unknown>;
  selectedProject?: any;
}

export function initializeData(settings?: InitializeDataSettings) {
  const _defaultProject = ProjectFixture();
  const _settings = {
    query: {},
    features: [],
    projects: [_defaultProject],
    project: _defaultProject,
    ...settings,
  };
  const {query, features, projects, selectedProject: project} = _settings;

  const organization = OrganizationFixture({
    features,
  });
  const routerLocation: {query: {project?: string}} = {
    query: {
      ...query,
    },
  };
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/performance/`,
      query: {...query} as Record<string, string>,
    },
    route: '/organizations/:orgId/performance/',
  };
  if (settings?.selectedProject || settings?.project) {
    routerLocation.query.project = project || settings?.project;
    initialRouterConfig.location.query.project = project || settings?.project;
  }
  const router = {
    location: routerLocation,
  };
  const initialData = initializeOrg({organization, projects, router});
  const location = initialData.router.location;
  const eventView = EventView.fromLocation(initialRouterConfig.location as any);

  return {
    ...initialData,
    /**
     * @deprecated use initialRouterConfig instead. Avoid deprecatedRouterMocks.
     */
    router: initialData.router,
    location,
    eventView,
    initialRouterConfig,
  };
}
