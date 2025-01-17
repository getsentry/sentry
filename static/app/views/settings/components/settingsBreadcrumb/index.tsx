import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import recreateRoute from 'sentry/utils/recreateRoute';

import {useBreadcrumbsPathmap} from './context';
import Crumb from './crumb';
import Divider from './divider';
import {OrganizationCrumb} from './organizationCrumb';
import ProjectCrumb from './projectCrumb';
import TeamCrumb from './teamCrumb';
import type {RouteWithName} from './types';

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
    <Breadcrumbs aria-label={t('Settings Breadcrumbs')} className={className}>
      {routes.map((route, i) => {
        if (!route.name) {
          return null;
        }
        const pathTitle = pathMap[getRouteStringFromRoutes(routes.slice(0, i + 1))];
        const isLast = i === lastRouteIndex;
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const createMenu = MENUS[route.name];
        const Menu = typeof createMenu === 'function' && createMenu;
        const hasMenu = !!Menu;

        if (hasMenu) {
          return (
            <Menu
              key={`${route.name}:${route.path}`}
              routes={routes}
              params={params}
              route={route}
              isLast={isLast}
            />
          );
        }
        return (
          <Crumb key={`${route.name}:${route.path}`}>
            <CrumbLink to={recreateRoute(route, {routes, params})}>
              {pathTitle || route.name}
            </CrumbLink>
            <Divider isLast={isLast} />
          </Crumb>
        );
      })}
    </Breadcrumbs>
  );
}

const CrumbLink = styled(Link)`
  display: block;

  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const Breadcrumbs = styled('nav')`
  display: flex;
  gap: ${space(0.75)};
  align-items: center;
`;

export {CrumbLink};

export default SettingsBreadcrumb;
