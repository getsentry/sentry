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

  return {
    organization,
    project,
    projects,
    router,
    routerContext,
    // not sure what purpose this serves
    route: {},
  };
}
