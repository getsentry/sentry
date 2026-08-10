import {useMemo, useState} from 'react';

import {Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import {BuilderBreadCrumbs} from 'sentry/views/alerts/builder/builderBreadCrumbs';
import {useAlertBuilderOutlet} from 'sentry/views/alerts/builder/projectProvider';

import {CronRulesEdit} from './rules/crons/edit';
import {UptimeRulesEdit} from './rules/uptime/edit';
import {CombinedAlertType} from './types';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

export default function ProjectAlertsEditor() {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<RouteParams>();
  const navigate = useNavigate();
  const routes = useRoutes();
  const {project} = useAlertBuilderOutlet();

  // The legacy alert rule editors below still consume the react-router 3
  // `InjectedRouter` interface. Build a minimal compatible shim until they're
  // migrated to use the navigate / location hooks directly.
  const router = useMemo<InjectedRouter>(
    () =>
      ({
        go: delta => navigate(delta),
        push: path => navigate(path),
        replace: path => navigate(path, {replace: true}),
        goBack: () => navigate(-1),
        goForward: () => navigate(1),
        location,
        params,
        routes,
        isActive: () => false,
      }) as InjectedRouter,
    [location, navigate, params, routes]
  );

  const [title, setTitle] = useState('');

  const alertTypeUrls = [
    {url: '/alerts/uptime-rules/', type: CombinedAlertType.UPTIME},
    {url: '/alerts/crons-rules/', type: CombinedAlertType.CRONS},
  ] as const;

  const alertType = alertTypeUrls.find(({url}) => location.pathname.includes(url))?.type;

  useRouteAnalyticsEventNames('edit_alert_rule.viewed', 'Edit Alert Rule: Viewed');
  useRouteAnalyticsParams({
    organization,
    project_id: project.id,
    alert_type: alertType,
  });

  //  Used to hide specific fields like actions while migrating metric alert rules.
  //  Currently used to help people add `is:unresolved` to their metric alert query.
  const isMigration = location?.query?.migration === '1';

  return (
    <Stack flex={1}>
      <SentryDocumentTitle
        title={title}
        orgSlug={organization.slug}
        projectSlug={project.slug}
      />
      <Layout.Header>
        <Layout.HeaderContent>
          <BuilderBreadCrumbs
            organization={organization}
            title={isMigration ? t('Review Thresholds') : t('Edit Alert Rule')}
            projectSlug={project.slug}
          />
          <Layout.Title>{title}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        {alertType === CombinedAlertType.UPTIME && (
          <UptimeRulesEdit
            location={location}
            params={params}
            router={router}
            routes={routes}
            route={{}}
            routeParams={params}
            organization={organization}
            onChangeTitle={setTitle}
          />
        )}
        {alertType === CombinedAlertType.CRONS && (
          <CronRulesEdit
            organization={organization}
            project={project}
            onChangeTitle={setTitle}
          />
        )}
      </Layout.Body>
    </Stack>
  );
}
