import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import BreadcrumbDropdown from './breadcrumbDropdown';
import LoadingIndicator from '../../../../components/loadingIndicator';
import MenuItem from './menuItem';
import SentryTypes from '../../../../proptypes';
import TextLink from '../../../../components/textLink';
import recreateRoute from '../../../../utils/recreateRoute';
import replaceRouterParams from '../../../../utils/replaceRouterParams';
import withLatestContext from '../../../../utils/withLatestContext';
import withProjects from '../../../../utils/withProjects';

const HEIGHT = '24px';
const ProjectName = styled.div`
  display: flex;

  .loading {
    width: 26px;
    height: ${HEIGHT};
    margin: 0;
  }
`;

const ProjectTextLink = styled(TextLink)`
  line-height: ${HEIGHT};
`;

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
              <div>
                <ProjectTextLink
                  to={replaceRouterParams('/settings/:orgId/:projectId/', {
                    orgId: latestOrganization.slug,
                    projectId: latestProject.slug,
                  })}
                >
                  {latestProject.slug}
                </ProjectTextLink>
              </div>
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
          label: <MenuItem>{project.slug}</MenuItem>,
        }))}
        {...props}
      />
    );
  }
}

export {ProjectCrumb};
export default withProjects(withLatestContext(ProjectCrumb));
