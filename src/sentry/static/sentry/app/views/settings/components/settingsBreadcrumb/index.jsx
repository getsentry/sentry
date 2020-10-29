import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import Crumb from 'app/views/settings/components/settingsBreadcrumb/crumb';
import Divider from 'app/views/settings/components/settingsBreadcrumb/divider';
import OrganizationCrumb from 'app/views/settings/components/settingsBreadcrumb/organizationCrumb';
import ProjectCrumb from 'app/views/settings/components/settingsBreadcrumb/projectCrumb';
import SentryTypes from 'app/sentryTypes';
import SettingsBreadcrumbActions from 'app/actions/settingsBreadcrumbActions';
import SettingsBreadcrumbStore from 'app/stores/settingsBreadcrumbStore';
import TeamCrumb from 'app/views/settings/components/settingsBreadcrumb/teamCrumb';
import Link from 'app/components/links/link';
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
    if (this.props.routes === prevProps.routes) {
      return;
    }
    SettingsBreadcrumbActions.trimMappings(this.props.routes);
  }

  render() {
    const {className, routes, params, pathMap} = this.props;
    const lastRouteIndex = routes.map(r => !!r.name).lastIndexOf(true);

    return (
      <Breadcrumbs className={className}>
        {routes.map((route, i) => {
          if (!route.name) {
            return null;
          }
          const pathTitle = pathMap[getRouteStringFromRoutes(routes.slice(0, i + 1))];
          const isLast = i === lastRouteIndex;
          const createMenu = MENUS[route.name];
          const Menu = typeof createMenu === 'function' && createMenu;
          const hasMenu = !!Menu;
          const CrumbPicker = hasMenu
            ? Menu
            : () => (
                <Crumb route={route} isLast={isLast}>
                  <CrumbLink to={recreateRoute(route, {routes, params})}>
                    {pathTitle || route.name}{' '}
                  </CrumbLink>
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

const CrumbLink = styled(Link)`
  display: block;

  &.focus-visible {
    outline: none;
    box-shadow: ${p => p.theme.blue400} 0 2px 0;
  }

  color: ${p => p.theme.gray600};
  &:hover {
    color: ${p => p.theme.gray800};
  }
`;

export {CrumbLink};

const Breadcrumbs = styled('div')`
  display: flex;
  align-items: center;
`;
