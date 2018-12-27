import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import IdBadge from 'app/components/idBadge';
import LoadingIndicator from 'app/components/loadingIndicator';
import MenuItem from 'app/views/settings/components/settingsBreadcrumb/menuItem';
import SentryTypes from 'app/sentryTypes';
import TextLink from 'app/components/textLink';
import recreateRoute from 'app/utils/recreateRoute';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import withLatestContext from 'app/utils/withLatestContext';
import withProjects from 'app/utils/withProjects';
import space from 'app/styles/space';

const ROUTE_PATH_EXCEPTIONS = new Set([':ruleId/', ':keyId/', ':hookId/', ':pluginId/']);

class ProjectCrumb extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    projects: PropTypes.array,
    routes: PropTypes.array,
    route: PropTypes.object,
  };

  handleSelect = item => {
    let {routes, params} = this.props;

    let lastRoute = routes[routes.length - 1];
    // We have to make exceptions for routes like "Project Alerts Rule Edit" or "Client Key Details"
    // Since these models are project specific, we need to traverse up a route when switching projects
    let stepBack = ROUTE_PATH_EXCEPTIONS.has(lastRoute.path) ? -1 : undefined;
    browserHistory.push(
      recreateRoute('', {
        routes,
        params: {...params, projectId: item.value},
        stepBack,
      })
    );
  };

  render() {
    let {
      organization: latestOrganization,
      project: latestProject,
      projects,
      route,
      ...props
    } = this.props;

    if (!latestOrganization) return null;
    if (!projects) return null;

    let hasMenu = projects && projects.length > 1;

    return (
      <BreadcrumbDropdown
        hasMenu={hasMenu}
        route={route}
        name={
          <ProjectName>
            {!latestProject ? (
              <LoadingIndicator mini />
            ) : (
              <TextLink
                to={replaceRouterParams('/settings/:orgId/:projectId/', {
                  orgId: latestOrganization.slug,
                  projectId: latestProject.slug,
                })}
              >
                <IdBadge project={latestProject} avatarSize={18} />
              </TextLink>
            )}
          </ProjectName>
        }
        onSelect={this.handleSelect}
        items={projects.map(project => ({
          value: project.slug,
          label: (
            <MenuItem>
              <IdBadge
                project={project}
                avatarProps={{consistentWidth: true}}
                avatarSize={18}
              />
            </MenuItem>
          ),
        }))}
        {...props}
      />
    );
  }
}

export {ProjectCrumb};
export default withProjects(withLatestContext(ProjectCrumb));

// Set height of crumb because of spinner
const SPINNER_SIZE = '24px';

const ProjectName = styled.div`
  display: flex;

  .loading {
    width: ${SPINNER_SIZE};
    height: ${SPINNER_SIZE};
    margin: 0 ${space(0.25)} 0 0;
  }
`;
