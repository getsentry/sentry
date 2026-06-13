import {useMatches} from 'react-router-dom';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';

import {IdBadge} from 'sentry/components/idBadge';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {trackAnalytics} from 'sentry/utils/analytics';
import {matchesToRoutes, recreateRoute} from 'sentry/utils/recreateRoute';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import type {
  RouteWithName,
  SettingsBreadcrumbProps,
} from 'sentry/views/settings/components/settingsBreadcrumb/types';

import {BreadcrumbDropdown} from './breadcrumbDropdown';
import {findFirstRouteWithoutRouteParam} from './findFirstRouteWithoutRouteParam';
import {CrumbLink} from '.';

export function ProjectCrumb({routeIndex, ...props}: SettingsBreadcrumbProps) {
  const navigate = useNavigate();
  const matches = useMatches();
  const routes = matchesToRoutes(matches);
  const route = routes[routeIndex] as RouteWithName;
  const {projects, onSearch} = useProjects();
  const organization = useOrganization();
  const params = useParams();
  const handleSelect = (projectSlug: string) => {
    const returnTo = findFirstRouteWithoutRouteParam(routes.slice(routeIndex + 1), route);

    if (returnTo === undefined) {
      return;
    }

    navigate(
      recreateRoute(returnTo, {
        matches,
        params: {...params, projectId: projectSlug},
      })
    );
  };

  const activeProject = projects.find(project => project.slug === params.projectId);

  return (
    <BreadcrumbDropdown
      hasMenu={projects && projects.length > 1}
      routeName={route.name}
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
      search={{onChange: onSearch}}
      options={projects.map(project => ({
        value: project.slug,
        leadingItems: <ProjectAvatar project={project} size={20} />,
        label: project.slug,
      }))}
      {...props}
    />
  );
}

// Set height of crumb because of spinner
const SPINNER_SIZE = '24px';

const ProjectName = styled('div')`
  display: flex;

  .loading {
    width: ${SPINNER_SIZE};
    height: ${SPINNER_SIZE};
    margin: 0 ${p => p.theme.space['2xs']} 0 0;
  }
`;
