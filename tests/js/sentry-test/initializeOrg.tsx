import type {Organization, Project} from 'sentry/types';

/**
 * Creates stubs for:
 *   - a project or projects
 *   - organization owning above projects
 *   - router
 *   - context that contains org + projects + router
 */
export function initializeOrg({
  organization: additionalOrg,
  project: additionalProject,
  projects: additionalProjects,
  router: additionalRouter,
}: {
  organization?: Partial<Organization>;
  project?: Partial<Project>;
  projects?: Partial<Project>[];
  router?: any;
} = {}) {
  const projects = (
    additionalProjects ||
    (additionalProject && [additionalProject]) || [{}]
  ).map(p => TestStubs.Project(p));
  const [project] = projects;
  const organization = TestStubs.Organization({
    projects,
    ...additionalOrg,
    orgRoleList: TestStubs.OrgRoleList(),
    teamRoleList: TestStubs.TeamRoleList(),
  });
  const router = TestStubs.router({
    ...additionalRouter,
    params: {
      orgId: organization.slug,
      projectId: projects[0]?.slug,
      ...additionalRouter?.params,
    },
  });

  const routerContext: any = TestStubs.routerContext([
    {
      organization,
      project,
      router,
      location: router.location,
    },
  ]);

  const routerProps = {
    params: router.params as {orgId: string; projectId: string},
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
    // not sure what purpose this serves
    route: {},
  };
}
