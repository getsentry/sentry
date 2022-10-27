import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import recreateRoute from 'sentry/utils/recreateRoute';
import Crumb from 'sentry/views/settings/components/settingsBreadcrumb/crumb';
import Divider from 'sentry/views/settings/components/settingsBreadcrumb/divider';
import OrganizationCrumb from 'sentry/views/settings/components/settingsBreadcrumb/organizationCrumb';
import ProjectCrumb from 'sentry/views/settings/components/settingsBreadcrumb/projectCrumb';
import TeamCrumb from 'sentry/views/settings/components/settingsBreadcrumb/teamCrumb';

import {useBreadcrumbsPathmap} from './context';
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
  const pathMap = useBreadcrumbsPathmap();

  const lastRouteIndex = routes.map(r => !!r.name).lastIndexOf(true);

  return (
    <Breadcrumbs aria-label={t('Settinsg Breadcrumbs')} className={className}>
      {routes.map((route, i) => {
        if (!route.name) {
          return null;
        }
        const pathTitle = pathMap[getRouteStringFromRoutes(routes.slice(0, i + 1))];
        const isLast = i === lastRouteIndex;
        const createMenu = MENUS[route.name];
        const Menu = typeof createMenu === 'function' && createMenu;
        const hasMenu = !!Menu;

        const CrumbItem = hasMenu
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
          <CrumbItem
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

  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export {CrumbLink};

const Breadcrumbs = styled('nav')`
  display: flex;
  align-items: center;
`;
