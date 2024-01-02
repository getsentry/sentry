import type {RouteComponent, RouteComponentProps} from 'react-router';
import type {Location} from 'history';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {OrgRoleList, TeamRoleList} from 'sentry-fixture/roleList';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import type {Organization as TOrganization, Project} from 'sentry/types';

// Workaround react-router PlainRoute type not covering redirect routes.
type RouteShape = {
  childRoutes?: RouteShape[];
  component?: RouteComponent;
  from?: string;
  indexRoute?: RouteShape;
  name?: string;
  path?: string;
};

interface InitializeOrgOptions<RouterParams> {
  organization?: Partial<TOrganization>;
  project?: Partial<Project>;
  projects?: Partial<Project>[];
  router?: {
    location?: Partial<Location>;
    params?: RouterParams;
    push?: jest.Mock;
    routes?: RouteShape[];
  };
}

/**
 * Creates stubs for:
 *   - a project or projects
 *   - organization owning above projects
 *   - router
 *   - context that contains org + projects + router
 */
export function initializeOrg<RouterParams = {orgId: string; projectId: string}>({
  organization: additionalOrg,
  project: additionalProject,
  projects: additionalProjects,
  router: additionalRouter,
}: InitializeOrgOptions<RouterParams> = {}) {
  const projects = (
    additionalProjects ||
    (additionalProject && [additionalProject]) || [{}]
  ).map(p => ProjectFixture(p));
  const [project] = projects;
  const organization = Organization({
    projects,
    ...additionalOrg,
    orgRoleList: OrgRoleList(),
    teamRoleList: TeamRoleList(),
  });
  const router = RouterFixture({
    ...additionalRouter,
    params: {
      orgId: organization.slug,
      projectId: projects[0]?.slug,
      ...additionalRouter?.params,
    },
  });

  const routerContext: any = RouterContextFixture([
    {
      organization,
      project,
      router,
      location: router.location,
    },
  ]);

  /**
   * A collection of router props that are passed to components by react-router
   *
   * Pass custom router params like so:
   * ```ts
   * initializeOrg({router: {params: {alertId: '123'}}})
   * ```
   */
  const routerProps: RouteComponentProps<RouterParams, {}> = {
    params: router.params as any,
    routeParams: router.params,
    router,
    route: router.routes[0],
    routes: router.routes,
    location: routerContext.context.location,
  };

  return {
    organization,
    project,
    projects,
    router,
    routerContext,
    routerProps,
    // @deprecated - not sure what purpose this serves
    route: {},
  };
}
