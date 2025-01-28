import styled from '@emotion/styled';

import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import recreateRoute from 'sentry/utils/recreateRoute';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import withLatestContext from 'sentry/utils/withLatestContext';

import BreadcrumbDropdown from './breadcrumbDropdown';
import findFirstRouteWithoutRouteParam from './findFirstRouteWithoutRouteParam';
import MenuItem from './menuItem';
import {CrumbLink} from '.';

type Props = RouteComponentProps<{projectId?: string}, {}> & {
  organization: Organization;
  project: Project;
  projects: Project[];
};

function ProjectCrumb({
  organization: latestOrganization,
  project: latestProject,
  params,
  routes,
  route,
  ...props
}: Props) {
  const navigate = useNavigate();
  const {projects} = useProjects();
  const handleSelect = (item: {value: string}) => {
    // We have to make exceptions for routes like "Project Alerts Rule Edit" or "Client Key Details"
    // Since these models are project specific, we need to traverse up a route when switching projects
    //
    // we manipulate `routes` so that it doesn't include the current project's route
    // which, unlike the org version, does not start with a route param
    const returnTo = findFirstRouteWithoutRouteParam(
      routes.slice(routes.indexOf(route) + 1),
      route
    );

    if (returnTo === undefined) {
      return;
    }

    navigate(
      recreateRoute(returnTo, {routes, params: {...params, projectId: item.value}})
    );
  };

  if (!latestOrganization) {
    return null;
  }
  if (!projects) {
    return null;
  }

  const hasMenu = projects && projects.length > 1;

  return (
    <BreadcrumbDropdown
      hasMenu={hasMenu}
      route={route}
      name={
        <ProjectName>
          {!latestProject ? (
            <LoadingIndicator mini />
          ) : (
            <CrumbLink
              to={replaceRouterParams('/settings/:orgId/projects/:projectId/', {
                orgId: latestOrganization.slug,
                projectId: latestProject.slug,
              })}
            >
              <IdBadge project={latestProject} avatarSize={18} disableLink />
            </CrumbLink>
          )}
        </ProjectName>
      }
      onSelect={handleSelect}
      items={projects.map((project, index) => ({
        index,
        value: project.slug,
        label: (
          <MenuItem>
            <IdBadge
              project={project}
              avatarProps={{consistentWidth: true}}
              avatarSize={18}
              disableLink
            />
          </MenuItem>
        ),
      }))}
      {...props}
    />
  );
}

export {ProjectCrumb};
export default withLatestContext(ProjectCrumb);

// Set height of crumb because of spinner
const SPINNER_SIZE = '24px';

const ProjectName = styled('div')`
  display: flex;

  .loading {
    width: ${SPINNER_SIZE};
    height: ${SPINNER_SIZE};
    margin: 0 ${space(0.25)} 0 0;
  }
`;
