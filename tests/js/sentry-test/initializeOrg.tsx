import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import type {
  InjectedRouter,
  PlainRoute,
  RouteComponentProps,
} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface RouteWithName extends PlainRoute {
  name?: string;
}

interface PartialInjectedRouter<P>
  extends Partial<Omit<InjectedRouter<P>, 'location' | 'routes'>> {
  location?: Partial<Location>;
  routes?: RouteWithName[];
}

interface InitializeOrgOptions<RouterParams> {
  organization?: Partial<Organization>;
  project?: Partial<Project>;
  projects?: Array<Partial<Project>>;
  router?: PartialInjectedRouter<RouterParams>;
}

/**
 * Creates stubs for:
 *   - a project or projects
 *   - organization owning above projects
 *   - router
 *   - context that contains router
 */
export function initializeOrg<RouterParams = {orgId: string; projectId: string}>({
  organization: additionalOrg,
  projects: additionalProjects,
  router: additionalRouter,
}: InitializeOrgOptions<RouterParams> = {}) {
  const organization = OrganizationFixture(additionalOrg);
  const projects = additionalProjects
    ? additionalProjects.map(ProjectFixture)
    : [ProjectFixture()];

  const [project] = projects;

  const router = RouterFixture({
    ...additionalRouter,
    params: {
      orgId: organization.slug,
      projectId: projects[0]?.slug,
      ...additionalRouter?.params,
    },
  });

  /**
   * A collection of router props that are passed to components by react-router
   *
   * Pass custom router params like so:
   * ```ts
   * initializeOrg({router: {params: {alertId: '123'}}})
   * ```
   */
  const routerProps: RouteComponentProps<RouterParams> = {
    params: router.params as any,
    routeParams: router.params,
    router,
    route: router.routes[0]!,
    routes: router.routes,
    location: router.location,
  };

  return {
    organization,
    project: project!,
    projects,
    router,
    routerProps,
  };
}
