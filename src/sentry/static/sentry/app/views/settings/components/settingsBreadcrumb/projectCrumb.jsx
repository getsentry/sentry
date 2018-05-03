import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import IdBadge from 'app/components/idBadge';
import LoadingIndicator from 'app/components/loadingIndicator';
import MenuItem from 'app/views/settings/components/settingsBreadcrumb/menuItem';
import SentryTypes from 'app/proptypes';
import TextLink from 'app/components/textLink';
import recreateRoute from 'app/utils/recreateRoute';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import withLatestContext from 'app/utils/withLatestContext';
import withProjects from 'app/utils/withProjects';
import space from 'app/styles/space';

class ProjectCrumb extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    projects: PropTypes.array,
    routes: PropTypes.array,
    route: PropTypes.object,
  };

  render() {
    let {
      organization: latestOrganization,
      project: latestProject,
      projects,
      params,
      routes,
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
                <IdBadge project={latestProject} />
              </TextLink>
            )}
          </ProjectName>
        }
        onSelect={item => {
          let lastRoute = routes[routes.length - 1];
          // We have to make an exception for "Project Alerts Rule Edit" route
          // Since these models are project specific, we need to traverse up a route when switching projects
          let stepBack = lastRoute.path === ':ruleId/' ? -1 : undefined;
          browserHistory.push(
            recreateRoute('', {
              routes,
              params: {...params, projectId: item.value},
              stepBack,
            })
          );
        }}
        items={projects.map(project => ({
          value: project.slug,
          label: (
            <MenuItem>
              <IdBadge project={project} />
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
