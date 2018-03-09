import {Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Crumb from './crumb.styled';
import InlineSvg from '../../../components/inlineSvg';
import LetterAvatar from '../../../components/letterAvatar';
import Link from '../../../components/link';
import LoadingIndicator from '../../../components/loadingIndicator';
import SentryTypes from '../../../proptypes';
import SettingsBreadcrumbDivider from './settingsBreadcrumbDivider';
import SettingsBreadcrumbDropdown from './settingsBreadcrumbDropdown';
import recreateRoute from '../../../utils/recreateRoute';
import replaceRouterParams from '../../../utils/replaceRouterParams';
import withLatestContext from '../../../utils/withLatestContext';
import withProjects from '../../../utils/withProjects';

const Breadcrumbs = styled.div`
  display: flex;
  align-items: center;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray3};
  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

const ProjectName = styled.div`
  display: flex;

  .loading {
    width: 26px;
    height: 24px;
    margin: 0;
  }
`;

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
`;

const LogoLink = styled.a`
  padding-right: 12px;
  margin-right: 12px;
  color: ${p => p.theme.gray4};
  z-index: 1;
  position: relative;

  &:after {
    display: block;
    content: '';
    position: absolute;
    right: 0;
    top: 2px;
    bottom: 2px;
    width: 1px;
    background: ${p => p.theme.borderDark};
  }

  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

// `organizationDetails` to differeniate from the organization that comes from `OrganizationsStore` which only has
// a fraction of an org's properties
const ProjectCrumb = withProjects(
  withLatestContext(
    ({
      organization: latestOrganization,
      project: latestProject,
      projects,
      params,
      routes,
      route,
      ...props
    }) => {
      if (!latestOrganization) return null;
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
                    {latestProject.slug}
                  </StyledLink>
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
  )
);

ProjectCrumb.displayName = 'ProjectCrumb';
ProjectCrumb.propTypes = {
  organizationDetails: SentryTypes.Organization,
  routes: PropTypes.array,
  route: PropTypes.object,
  isLast: PropTypes.bool,
};

const MENUS = {
  Organization: withLatestContext(
    ({organizations, organization, params, routes, route, isLast, ...props}) => {
      let hasMenu = organizations.length > 1;

      return (
        <SettingsBreadcrumbDropdown
          name={
            <StyledLink
              to={recreateRoute(route, {
                routes,
                params: {...params, orgId: organization.slug},
              })}
            >
              <Flex align="center">
                <span style={{width: 18, height: 18, marginRight: 6}}>
                  <LetterAvatar
                    style={{display: 'inline-block'}}
                    displayName={organization.slug}
                    identifier={organization.slug}
                  />
                </span>
                {organization.slug}
              </Flex>
            </StyledLink>
          }
          onSelect={item => {
            browserHistory.push(
              recreateRoute(route, {
                routes,
                params: {...params, orgId: item.value},
              })
            );
          }}
          hasMenu={hasMenu}
          route={route}
          items={organizations.map(org => ({
            value: org.slug,
            label: org.slug,
          }))}
          {...props}
        />
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
  };

  render() {
    let {routes, params} = this.props;
    let routesWithNames = routes.filter(({name}) => name);
    let lastRouteIndex = routesWithNames.length - 1;
    return (
      <Breadcrumbs>
        <LogoLink href="/">
          <StyledInlineSvg src="icon-sentry" size="20px" />
        </LogoLink>
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
