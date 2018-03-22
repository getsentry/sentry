import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import BreadcrumbDropdown from './breadcrumbDropdown';
import LoadingIndicator from '../../../../components/loadingIndicator';
import SentryTypes from '../../../../proptypes';
import TextLink from '../../../../components/textLink';
import recreateRoute from '../../../../utils/recreateRoute';
import replaceRouterParams from '../../../../utils/replaceRouterParams';
import withLatestContext from '../../../../utils/withLatestContext';
import withProjects from '../../../../utils/withProjects';

const ProjectName = styled.div`
  display: flex;

  .loading {
    width: 26px;
    height: 24px;
    margin: 0;
  }
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
                <TextLink
                  to={replaceRouterParams('/settings/:orgId/:projectId/', {
                    orgId: latestOrganization.slug,
                    projectId: latestProject.slug,
                  })}
                >
                  {latestProject.slug}
                </TextLink>
              </div>
            )}
          </ProjectName>
        }
        onSelect={item => {
          browserHistory.push(
            recreateRoute(route, {
              routes,
              params: {...params, projectId: item.value},
            })
          );
        }}
        items={projects.map(project => ({
          value: project.slug,
          label: project.slug,
        }))}
        {...props}
      />
    );
  }
}

export {ProjectCrumb};
export default withProjects(withLatestContext(ProjectCrumb));
