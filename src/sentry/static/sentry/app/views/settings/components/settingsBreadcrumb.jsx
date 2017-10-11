import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import styled from 'react-emotion';

import OrganizationStore from '../../../stores/organizationStore';
import Link from '../../../components/link';
import SentryTypes from '../../../proptypes';
import recreateRoute from '../../../utils/recreateRoute';

import Crumb from './crumb.styled';
import SettingsBreadcrumbDropdown from './settingsBreadcrumbDropdown';
import SettingsBreadcrumbDivider from './settingsBreadcrumbDivider';

const Breadcrumbs = styled.div`
  display: flex;
  align-items: center;
`;

const MenuItem = styled(Link)`
  display: block;
  padding: 15px;
  border-bottom: 1px solid ${p => p.theme.borderLight};

  &:last-child {
    border: none;
  }

  &:hover {
    background: ${p => p.theme.offWhite};
  }

  ${p =>
    p.active
      ? `
      font-weight: bold;
    background: ${p.theme.offWhite};
  `
      : ''};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray3};
  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

const withOrganizations = WrappedComponent =>
  React.createClass({
    mixins: [Reflux.connect(OrganizationStore, 'organizations')],
    render() {
      return (
        <WrappedComponent organizations={this.state.organizations} {...this.props} />
      );
    },
  });

const ProjectCrumb = ({team, organization, params, routes, route, ...props}) => {
  if (!organization) return null;

  let {teams} = organization;
  let {projects} = teams.find(({slug}) => slug === team.slug) || {};
  let hasMenu = projects && projects.length > 1;

  return (
    <SettingsBreadcrumbDropdown hasMenu={hasMenu} route={route} {...props}>
      {projects.map(project => (
        <MenuItem
          to={recreateRoute(route, {
            routes,
            params: {...params, projectId: project.slug},
          })}
          active={project.slug === params.projectId}
          key={project.slug}
        >
          {project.name}
        </MenuItem>
      ))}
    </SettingsBreadcrumbDropdown>
  );
};
ProjectCrumb.displayName = 'ProjectCrumb';
ProjectCrumb.propTypes = {
  team: SentryTypes.Team,
  organization: SentryTypes.Organization,
  routes: PropTypes.array,
  route: PropTypes.object,
  isLast: PropTypes.bool,
};

const MENUS = {
  Organization: withOrganizations(
    ({organizations, params, routes, route, isLast, ...props}) => {
      let hasMenu = organizations.length > 1;

      return (
        <SettingsBreadcrumbDropdown hasMenu={hasMenu} route={route} {...props}>
          {organizations.map(organization => (
            <MenuItem
              to={recreateRoute(route, {
                routes,
                params: {...params, orgId: organization.slug},
              })}
              key={organization.slug}
            >
              {organization.name}
            </MenuItem>
          ))}
        </SettingsBreadcrumbDropdown>
      );
    }
  ),

  Project: ProjectCrumb,
};

class SettingsBreadcrumb extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
    team: SentryTypes.Team,
  };

  render() {
    let {routes, params} = this.props;
    let routesWithNames = routes.filter(({name}) => name);
    let lastRouteIndex = routesWithNames.length - 1;
    return (
      <Breadcrumbs>
        {routesWithNames.map((route, i) => {
          let isLast = i === lastRouteIndex;
          let createMenu = MENUS[route.name];
          let Menu = typeof createMenu === 'function' && createMenu;
          let hasMenu = !!Menu;
          let CrumbPicker = hasMenu
            ? Menu
            : () => (
                <Crumb route={route} isLast={isLast}>
                  <StyledLink to={recreateRoute(route, {routes, params})}>
                    {route.name}{' '}
                  </StyledLink>
                  <SettingsBreadcrumbDivider isLast={isLast} />
                </Crumb>
              );

          return (
            <CrumbPicker
              key={`${route.name}:${route.path}`}
              organization={this.context.organization}
              team={this.context.team}
              routes={routes}
              params={params}
              route={route}
              isLast={isLast}
            />
          );
        })}
      </Breadcrumbs>
    );
  }
}

export default SettingsBreadcrumb;
