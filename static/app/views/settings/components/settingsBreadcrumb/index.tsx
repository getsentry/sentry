import {Component} from 'react';
import styled from '@emotion/styled';

import SettingsBreadcrumbActions from 'app/actions/settingsBreadcrumbActions';
import Link from 'app/components/links/link';
import SettingsBreadcrumbStore from 'app/stores/settingsBreadcrumbStore';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import recreateRoute from 'app/utils/recreateRoute';
import Crumb from 'app/views/settings/components/settingsBreadcrumb/crumb';
import Divider from 'app/views/settings/components/settingsBreadcrumb/divider';
import OrganizationCrumb from 'app/views/settings/components/settingsBreadcrumb/organizationCrumb';
import ProjectCrumb from 'app/views/settings/components/settingsBreadcrumb/projectCrumb';
import TeamCrumb from 'app/views/settings/components/settingsBreadcrumb/teamCrumb';

import {RouteWithName} from './types';

const MENUS = {
  Organization: OrganizationCrumb,
  Project: ProjectCrumb,
  Team: TeamCrumb,
} as const;

type Props = {
  className?: string;
  routes: RouteWithName[];
  pathMap: Record<string, string>;
  params: {[param: string]: string | undefined};
  route: any;
};

class SettingsBreadcrumb extends Component<Props> {
  static defaultProps = {
    pathMap: {},
  };

  componentDidUpdate(prevProps: Props) {
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
                <Crumb>
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

type ConnectedState = Pick<Props, 'pathMap'>;

class ConnectedSettingsBreadcrumb extends Component<
  Omit<Props, 'pathMap'>,
  ConnectedState
> {
  state: ConnectedState = {pathMap: SettingsBreadcrumbStore.getPathMap()};

  componentWillUnmount() {
    this.unsubscribe();
  }
  unsubscribe = SettingsBreadcrumbStore.listen(
    (pathMap: ConnectedState['pathMap']) => this.setState({pathMap}),
    undefined
  );

  render() {
    return <SettingsBreadcrumb {...this.props} {...this.state} />;
  }
}

export default ConnectedSettingsBreadcrumb;

const CrumbLink = styled(Link)`
  display: block;

  &.focus-visible {
    outline: none;
    box-shadow: ${p => p.theme.blue300} 0 2px 0;
  }

  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export {CrumbLink};

const Breadcrumbs = styled('div')`
  display: flex;
  align-items: center;
`;
