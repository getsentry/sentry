import {useEffect} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import SettingsBreadcrumbStore from 'sentry/stores/settingsBreadcrumbStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import recreateRoute from 'sentry/utils/recreateRoute';
import Crumb from 'sentry/views/settings/components/settingsBreadcrumb/crumb';
import Divider from 'sentry/views/settings/components/settingsBreadcrumb/divider';
import OrganizationCrumb from 'sentry/views/settings/components/settingsBreadcrumb/organizationCrumb';
import ProjectCrumb from 'sentry/views/settings/components/settingsBreadcrumb/projectCrumb';
import TeamCrumb from 'sentry/views/settings/components/settingsBreadcrumb/teamCrumb';

import {RouteWithName} from './types';

const MENUS = {
  Organization: OrganizationCrumb,
  Project: ProjectCrumb,
  Team: TeamCrumb,
} as const;

type Props = {
  params: {[param: string]: string | undefined};
  route: any;
  routes: RouteWithName[];
  className?: string;
};

function SettingsBreadcrumb({className, routes, params}: Props) {
  const {pathMap} = useLegacyStore(SettingsBreadcrumbStore);

  useEffect(() => {
    SettingsBreadcrumbStore.trimMappings(routes);
  }, [routes]);

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

export default SettingsBreadcrumb;

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
