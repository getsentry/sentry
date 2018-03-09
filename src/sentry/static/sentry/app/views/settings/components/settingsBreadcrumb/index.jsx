import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Crumb from './crumb';
import Divider from './divider';
import InlineSvg from '../../../../components/inlineSvg';
import OrganizationCrumb from './organizationCrumb';
import ProjectCrumb from './projectCrumb';
import SentryTypes from '../../../../proptypes';
import TeamCrumb from './teamCrumb';
import TextLink from '../../../../components/textLink';
import recreateRoute from '../../../../utils/recreateRoute';

const MENUS = {
  Organization: OrganizationCrumb,
  Project: ProjectCrumb,
  Team: TeamCrumb,
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
                  <TextLink to={recreateRoute(route, {routes, params})}>
                    {route.name}{' '}
                  </TextLink>
                  <Divider isLast={isLast} />
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

const Breadcrumbs = styled.div`
  display: flex;
  align-items: center;
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
