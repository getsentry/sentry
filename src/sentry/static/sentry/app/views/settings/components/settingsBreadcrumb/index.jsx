import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import Crumb from 'app/views/settings/components/settingsBreadcrumb/crumb';
import Divider from 'app/views/settings/components/settingsBreadcrumb/divider';
import InlineSvg from 'app/components/inlineSvg';
import OrganizationCrumb from 'app/views/settings/components/settingsBreadcrumb/organizationCrumb';
import ProjectCrumb from 'app/views/settings/components/settingsBreadcrumb/projectCrumb';
import SentryTypes from 'app/sentryTypes';
import SettingsBreadcrumbActions from 'app/actions/settingsBreadcrumbActions';
import SettingsBreadcrumbStore from 'app/stores/settingsBreadcrumbStore';
import TeamCrumb from 'app/views/settings/components/settingsBreadcrumb/teamCrumb';
import TextLink from 'app/components/textLink';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import recreateRoute from 'app/utils/recreateRoute';

const MENUS = {
  Organization: OrganizationCrumb,
  Project: ProjectCrumb,
  Team: TeamCrumb,
};

class SettingsBreadcrumb extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
    // pathMap maps stringifed routes to a breadcrumb title. This property is
    // provided by the SettingsBreadcrumbStore.
    pathMap: PropTypes.object,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  static defaultProps = {
    pathMap: {},
  };

  componentDidUpdate(prevProps) {
    if (this.props.routes === prevProps.routes) return;
    SettingsBreadcrumbActions.trimMappings(this.props.routes);
  }

  render() {
    let {routes, params, pathMap} = this.props;
    let lastRouteIndex = routes.map(r => !!r.name).lastIndexOf(true);
    return (
      <Breadcrumbs>
        <LogoLink href="/">
          <StyledInlineSvg src="icon-sentry" size="20px" />
        </LogoLink>
        {routes.map((route, i) => {
          if (!route.name) return null;
          let pathTitle = pathMap[getRouteStringFromRoutes(routes.slice(0, i + 1))];
          let isLast = i === lastRouteIndex;
          let createMenu = MENUS[route.name];
          let Menu = typeof createMenu === 'function' && createMenu;
          let hasMenu = !!Menu;
          let CrumbPicker = hasMenu
            ? Menu
            : () => (
                <Crumb route={route} isLast={isLast}>
                  <TextLink to={recreateRoute(route, {routes, params})}>
                    {pathTitle || route.name}{' '}
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

export default createReactClass({
  displayName: 'ConnectedSettingsBreadcrumb',
  mixins: [Reflux.connect(SettingsBreadcrumbStore, 'pathMap')],
  render() {
    return <SettingsBreadcrumb {...this.props} {...this.state} />;
  },
});

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
