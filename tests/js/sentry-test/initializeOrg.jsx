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
} = {}) {
  const projects = (
    additionalProjects ||
    (additionalProject && [additionalProject]) || [{}]
  ).map(p => TestStubs.Project(p));
  const [project] = projects;
  const organization = TestStubs.Organization({
    projects,
    ...additionalOrg,
  });
  const router = TestStubs.router({
    ...additionalRouter,
    params: {
      orgId: organization.slug,
      ...additionalRouter?.params,
    },
  });

  const routerContext = TestStubs.routerContext([
    {
      organization,
      project,
      router,
      location: router.location,
    },
  ]);

  return {
    org: organization,
    organization,
    project,
    projects,
    router,
    routerContext,
  };
}
