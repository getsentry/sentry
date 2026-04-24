import {Link as RouterLink} from 'react-router-dom';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import {useBreadcrumbsPathmap} from './context';
import {Divider} from './divider';
import {ProjectCrumb} from './projectCrumb';
import {TeamCrumb} from './teamCrumb';
import type {RouteWithName, SettingsBreadcrumbProps} from './types';

const MENUS: Record<string, React.FC<SettingsBreadcrumbProps>> = {
  Project: ProjectCrumb,
  Team: TeamCrumb,
} as const;

type Props = {
  params: Record<string, string | undefined>;
  routes: RouteWithName[];
  className?: string;
};

export function SettingsBreadcrumb({className, routes, params}: Props) {
  const pathMap = useBreadcrumbsPathmap();
  const hasPageFrame = useHasPageFrameFeature();

  const lastRouteIndex = routes.map(r => !!r.name).lastIndexOf(true);

  function onSettingsBreadcrumbLinkClick() {
    trackAnalytics('breadcrumbs.link.clicked', {organization: null});
  }

  return (
    <Flex
      as="nav"
      align="center"
      gap="sm"
      aria-label={t('Settings Breadcrumbs')}
      className={className}
    >
      {routes.map((route, i) => {
        if (!route.name) {
          return null;
        }
        // Only routes with their own path participate in the pathTitle
        // override; an index child with no path would otherwise collide with
        // its parent's key and show the parent's title.
        const pathTitle = route.path
          ? pathMap[getRouteStringFromRoutes({routes: routes.slice(0, i + 1)})]
          : undefined;
        const isLast = i === lastRouteIndex;
        const Menu = MENUS[route.name];
        const hasMenu = !!Menu;

        if (hasMenu) {
          return (
            <Menu
              key={`${route.name}:${route.path}`}
              routes={routes}
              route={route}
              isLast={isLast}
            />
          );
        }
        // In page-frame mode the current-page crumb is rendered as a
        // non-interactive label; legacy mode keeps the original self-link.
        if (isLast && hasPageFrame) {
          return (
            <Flex gap="sm" align="center" key={`${route.name}:${route.path}`}>
              <CurrentCrumb aria-current="page">{pathTitle || route.name}</CurrentCrumb>
            </Flex>
          );
        }
        return (
          <Flex gap="sm" align="center" key={`${route.name}:${route.path}`}>
            <CrumbLink
              to={recreateRoute(route, {routes, params})}
              onClick={onSettingsBreadcrumbLinkClick}
            >
              {pathTitle || route.name}
            </CrumbLink>
            {isLast ? null : <Divider />}
          </Flex>
        );
      })}
    </Flex>
  );
}

// Uses Link directly from react-router-dom to avoid the URL normalization
// that happens in the internal Link component. It is unnecessary because we
// get routes from the router, and will actually cause issues because the
// routes do not have organization information.
export const CrumbLink = styled(RouterLink)`
  display: block;
  line-height: ${p => p.theme.font.lineHeight.default};

  color: ${p => p.theme.tokens.content.secondary};
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const CurrentCrumb = styled('span')`
  display: block;
  line-height: ${p => p.theme.font.lineHeight.default};
  color: ${p => p.theme.tokens.content.primary};
`;
