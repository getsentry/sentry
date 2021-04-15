import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import IdBadge from 'app/components/idBadge';
import LoadingIndicator from 'app/components/loadingIndicator';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import recreateRoute from 'app/utils/recreateRoute';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import withLatestContext from 'app/utils/withLatestContext';
import withProjects from 'app/utils/withProjects';
import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import findFirstRouteWithoutRouteParam from 'app/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam';
import MenuItem from 'app/views/settings/components/settingsBreadcrumb/menuItem';

import {RouteWithName} from './types';
import {CrumbLink} from '.';

type Props = RouteComponentProps<{projectId?: string}, {}> & {
  organization: Organization;
  project: Project;
  projects: Project[];
  routes: RouteWithName[];
  route: RouteWithName;
};

const ProjectCrumb = ({
  organization: latestOrganization,
  project: latestProject,
  projects,
  params,
  routes,
  route,
  ...props
}: Props) => {
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

    browserHistory.push(
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
};

export {ProjectCrumb};
export default withProjects(withLatestContext(ProjectCrumb));

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
