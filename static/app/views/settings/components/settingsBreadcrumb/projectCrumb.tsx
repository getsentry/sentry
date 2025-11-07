import styled from '@emotion/styled';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import recreateRoute from 'sentry/utils/recreateRoute';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import type {SettingsBreadcrumbProps} from 'sentry/views/settings/components/settingsBreadcrumb/types';

import BreadcrumbDropdown from './breadcrumbDropdown';
import findFirstRouteWithoutRouteParam from './findFirstRouteWithoutRouteParam';
import {CrumbLink} from '.';

function ProjectCrumb({routes, route, ...props}: SettingsBreadcrumbProps) {
  const navigate = useNavigate();
  const {projects, onSearch} = useProjects();
  const organization = useOrganization();
  const params = useParams();
  const handleSelect = (projectSlug: string) => {
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
      recreateRoute(returnTo, {routes, params: {...params, projectId: projectSlug}})
    );
  };

  const activeProject = projects.find(project => project.slug === params.projectId);

  return (
    <BreadcrumbDropdown
      hasMenu={projects && projects.length > 1}
      route={route}
      name={
        <ProjectName>
          {activeProject ? (
            <CrumbLink
              to={replaceRouterParams('/settings/:orgId/projects/:projectId/', {
                orgId: organization.slug,
                projectId: activeProject.slug,
              })}
            >
              <IdBadge project={activeProject} avatarSize={18} disableLink />
            </CrumbLink>
          ) : (
            <LoadingIndicator mini />
          )}
        </ProjectName>
      }
      value={activeProject?.slug ?? ''}
      onCrumbSelect={handleSelect}
      onOpenChange={open => {
        if (open) {
          trackAnalytics('breadcrumbs.menu.opened', {organization: null});
        }
      }}
      onSearch={onSearch}
      options={projects.map(project => ({
        value: project.slug,
        leadingItems: <ProjectAvatar project={project} size={20} />,
        label: project.slug,
      }))}
      {...props}
    />
  );
}

export default ProjectCrumb;

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
