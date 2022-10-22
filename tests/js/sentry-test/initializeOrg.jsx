import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {OrgRoleList, TeamRoleList} from 'fixtures/js-stubs/roleList';
import {router as routerStub} from 'fixtures/js-stubs/router';
import {routerContext as routerContextStub} from 'fixtures/js-stubs/routerContext';
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
  ).map(p => Project(p));
  const [project] = projects;
  const organization = Organization({
    projects,
    ...additionalOrg,
    orgRoleList: OrgRoleList(),
    teamRoleList: TeamRoleList(),
  });
  const router = routerStub({
    ...additionalRouter,
    params: {
      orgId: organization.slug,
      ...additionalRouter?.params,
    },
  });

  const routerContext = routerContextStub([
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
