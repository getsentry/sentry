import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import styled from 'react-emotion';
import {withTheme} from 'emotion-theming';

import OrganizationStore from '../../../stores/organizationStore';
import Link from '../../../components/link';
import SentryTypes from '../../../proptypes';
import recreateRoute from '../../../utils/recreateRoute';

import IconChevronRight from '../../../icons/icon-chevron-right';

const withOrganizations = WrappedComponent =>
  React.createClass({
    mixins: [Reflux.connect(OrganizationStore, 'organizations')],
    render() {
      return (
        <WrappedComponent organizations={this.state.organizations} {...this.props} />
      );
    },
  });

const ProjectCrumb = ({team, organization, params, routes, route, isLast}) => {
  if (!organization) return null;

  let {teams} = organization;
  let {projects} = teams.find(({slug}) => slug === team.slug) || {};
  let hasMenu = projects && projects.length > 1;

  return (
    <Crumb hasMenu={hasMenu}>
      <div style={{display: 'inline'}}>{route.name} </div>
      {!isLast && (
        <Divider hasMenu={hasMenu}>
          <IconChevronRight size="15" />
        </Divider>
      )}
      <Menu className="menu">
        {projects.map(project => (
          <MenuItem
            to={recreateRoute(route, {
              routes,
              params: {...params, projectId: project.slug},
            })}
            key={project.slug}
          >
            {project.name}
          </MenuItem>
        ))}
      </Menu>
    </Crumb>
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
  Organization: withOrganizations(({organizations, params, routes, route, isLast}) => {
    let hasMenu = organizations.length > 1;

    return (
      <Crumb hasMenu={hasMenu}>
        <div style={{display: 'inline'}}>{route.name} </div>
        {!isLast && (
          <Divider hasMenu={hasMenu}>
            <IconChevronRight size="15" />
          </Divider>
        )}
        <Menu className="menu">
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
        </Menu>
      </Crumb>
    );
  }),

  Project: ProjectCrumb,
};

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray3};
  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

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
                  {!isLast && (
                    <Divider>
                      <IconChevronRight size="15" />
                    </Divider>
                  )}
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

const Breadcrumbs = withTheme(
  styled.div`
    display: flex;
    align-items: center;
  `
);

const Crumb = styled('div')`
  display: block;
  position: relative;
  font-size: 18px;
  color: ${p => p.theme.gray3};
  margin-right: 10px;
  cursor: pointer;
  > span {
    transition: 0.1s all ease;
  }

  &:hover {
    color: ${p => p.theme.gray5};
    ${p =>
      p.hasMenu
        ? `> span {
      transform: rotate(90deg);
      top: 0;
    }`
        : ''} > .menu {
      opacity: 1;
      visibility: visible;
    }
  }
`;

const Divider = styled.span`
  display: inline-block;
  margin-left: 6px;
  color: ${p => p.theme.gray1};
  position: relative;
  top: -1px;
`;

const Menu = styled.div`
  font-size: 16px;
  opacity: 0;
  visibility: hidden;
  position: absolute;
  top: 140%;
  width: 200px;
  background: #fff;
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  transition: 0.1s all ease;
  border-radius: ${p => p.theme.radius};
  overflow: hidden;
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
`;

export default SettingsBreadcrumb;
