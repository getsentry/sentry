import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {connect} from 'react-redux';

import Crumb from './crumb.styled';
import Link from '../../../components/link';
import LoadingIndicator from '../../../components/loadingIndicator';
import SentryTypes from '../../../proptypes';
import SettingsBackButton from './settingsBackButton';
import SettingsBreadcrumbDivider from './settingsBreadcrumbDivider';
import SettingsBreadcrumbDropdown from './settingsBreadcrumbDropdown';
import recreateRoute from '../../../utils/recreateRoute';
import replaceRouterParams from '../../../utils/replaceRouterParams';

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

const ProjectName = styled.div`
  display: flex;
`;

// `organizationDetails` to differeniate from the organization that comes from `OrganizationsStore` which only has
// a fraction of an org's properties

class ProjectCrumb extends React.Component {
  static propTypes = {
    team: SentryTypes.Team,
    organizationDetails: SentryTypes.Organization,
    routes: PropTypes.array,
    route: PropTypes.object,
    isLast: PropTypes.bool,
    latestOrganization: SentryTypes.Organization,
    latestProject: SentryTypes.Project,
  };

  render() {
    const props = this.props;
    const {latestOrganization, latestProject, team, route, routes, params} = props;

    if (!latestOrganization) return null;

    let {teams} = latestOrganization;
    let teamFromOrg = (teams && teams.find(({slug}) => slug === team.slug)) || {};
    let {projects} = teamFromOrg;

    if (!projects) return null;

    let hasMenu = projects && projects.length > 1;

    return (
      <SettingsBreadcrumbDropdown
        hasMenu={hasMenu}
        route={route}
        name={
          <ProjectName>
            {!latestProject ? (
              <LoadingIndicator mini />
            ) : (
              <div>
                <StyledLink
                  to={replaceRouterParams(
                    '/settings/organization/:orgId/project/:projectId/',
                    {
                      orgId: latestOrganization.slug,
                      projectId: latestProject.slug,
                    }
                  )}
                >
                  {`${teamFromOrg.name} / ${latestProject.name}`}
                </StyledLink>
              </div>
            )}
          </ProjectName>
        }
        {...props}
      >
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
  }
}

class OrganizationCrumb extends React.Component {
  static propTypes = {
    team: SentryTypes.Team,
    organizationDetails: SentryTypes.Organization,
    routes: PropTypes.array,
    route: PropTypes.object,
    isLast: PropTypes.bool,
    latestOrganization: SentryTypes.Organization,
    latestProject: SentryTypes.Project,
    organizations: PropTypes.arrayOf(SentryTypes.Organization),
  };

  render() {
    const {routes, route, latestOrganization, params, organizations} = this.props;
    const hasMenu = organizations.length > 1;
    return (
      <SettingsBreadcrumbDropdown
        name={
          <StyledLink
            to={recreateRoute(route, {
              routes,
              params: {...params, orgId: latestOrganization.slug},
            })}
          >
            {latestOrganization.name}
          </StyledLink>
        }
        hasMenu={hasMenu}
        route={route}
        {...this.props}
      >
        {organizations.map(org => (
          <MenuItem
            to={recreateRoute(route, {
              routes,
              params: {...params, orgId: org.slug},
            })}
            active={org.slug === params.orgId}
            key={org.slug}
          >
            {org.name}
          </MenuItem>
        ))}
      </SettingsBreadcrumbDropdown>
    );
  }
}

const MENUS = {
  Organization: OrganizationCrumb,
  Project: ProjectCrumb,
};

class SettingsBreadcrumb extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
    latestOrganization: SentryTypes.Organization,
    latestProject: SentryTypes.Project,
    organizations: PropTypes.arrayOf(SentryTypes.Organization),
  };

  static contextTypes = {
    team: SentryTypes.Team,
  };

  render() {
    let {routes, params, latestProject, latestOrganization, organizations} = this.props;
    let routesWithNames = routes.filter(({name}) => name);
    let lastRouteIndex = routesWithNames.length - 1;
    return (
      <Breadcrumbs>
        <Crumb>
          <SettingsBackButton params={params} />
          <SettingsBreadcrumbDivider />
        </Crumb>

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
              team={this.context.team}
              routes={routes}
              params={params}
              route={route}
              isLast={isLast}
              latestProject={latestProject}
              latestOrganization={latestOrganization}
              organizations={organizations}
            />
          );
        })}
      </Breadcrumbs>
    );
  }
}

const mapStateToProps = state => {
  return {
    organizations: state.organization.organizations,
    latestProject: state.latestContext.project,
    latestOrganization: state.latestContext.organization,
  };
};

export default connect(mapStateToProps)(SettingsBreadcrumb);
