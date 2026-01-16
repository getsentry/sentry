import {Fragment, useState} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import {useAlertBuilderOutlet} from 'sentry/views/alerts/builder/projectProvider';

import {CronRulesEdit} from './rules/crons/edit';
import IssueEditor from './rules/issue';
import {MetricRulesEdit} from './rules/metric/edit';
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
  const router = useRouter();
  const routes = useRoutes();
  const {project, members} = useAlertBuilderOutlet();

  const [title, setTitle] = useState('');

  const alertTypeUrls = [
    {url: '/alerts/metric-rules/', type: CombinedAlertType.METRIC},
    {url: '/alerts/uptime-rules/', type: CombinedAlertType.UPTIME},
    {url: '/alerts/crons-rules/', type: CombinedAlertType.CRONS},
    {url: '/alerts/rules/', type: CombinedAlertType.ISSUE},
  ] as const;

  const alertType =
    alertTypeUrls.find(({url}) => location.pathname.includes(url))?.type ??
    CombinedAlertType.ISSUE;

  useRouteAnalyticsEventNames('edit_alert_rule.viewed', 'Edit Alert Rule: Viewed');
  useRouteAnalyticsParams({
    organization,
    project_id: project.id,
    alert_type: alertType,
  });

  //  Used to hide specific fields like actions while migrating metric alert rules.
  //  Currently used to help people add `is:unresolved` to their metric alert query.
  const isMigration = location?.query?.migration === '1';

  const {teams, isLoading: teamsLoading} = useUserTeams();

  return (
    <Fragment>
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
        {teamsLoading ? (
          <LoadingIndicator />
        ) : (
          <Fragment>
            {alertType === CombinedAlertType.ISSUE && (
              <IssueEditor
                location={location}
                params={params}
                router={router}
                routes={routes}
                route={{}}
                routeParams={params}
                project={project}
                onChangeTitle={setTitle}
                userTeamIds={teams.map(({id}) => id)}
                members={members}
              />
            )}
            {alertType === CombinedAlertType.METRIC && (
              <MetricRulesEdit
                location={location}
                params={params}
                router={router}
                routes={routes}
                route={{}}
                routeParams={params}
                organization={organization}
                project={project}
                onChangeTitle={setTitle}
                userTeamIds={teams.map(({id}) => id)}
              />
            )}
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
                userTeamIds={teams.map(({id}) => id)}
              />
            )}
            {alertType === CombinedAlertType.CRONS && (
              <CronRulesEdit
                organization={organization}
                project={project}
                onChangeTitle={setTitle}
              />
            )}
          </Fragment>
        )}
      </Layout.Body>
    </Fragment>
  );
}
