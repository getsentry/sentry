import {Fragment, useState} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Member, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';

import {CronRulesEdit} from './rules/crons/edit';
import IssueEditor from './rules/issue';
import {MetricRulesEdit} from './rules/metric/edit';
import {UptimeRulesEdit} from './rules/uptime/edit';
import {CombinedAlertType} from './types';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

type Props = RouteComponentProps<RouteParams> & {
  hasMetricAlerts: boolean;
  hasUptimeAlerts: boolean;
  members: Member[] | undefined;
  organization: Organization;
  project: Project;
};

function ProjectAlertsEditor(props: Props) {
  const {members, organization, project} = props;
  const location = useLocation();

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
        {!teamsLoading ? (
          <Fragment>
            {alertType === CombinedAlertType.ISSUE && (
              <IssueEditor
                {...props}
                project={project}
                onChangeTitle={setTitle}
                userTeamIds={teams.map(({id}) => id)}
                members={members}
              />
            )}
            {alertType === CombinedAlertType.METRIC && (
              <MetricRulesEdit
                {...props}
                project={project}
                onChangeTitle={setTitle}
                userTeamIds={teams.map(({id}) => id)}
              />
            )}
            {alertType === CombinedAlertType.UPTIME && (
              <UptimeRulesEdit
                {...props}
                project={project}
                onChangeTitle={setTitle}
                userTeamIds={teams.map(({id}) => id)}
              />
            )}
            {alertType === CombinedAlertType.CRONS && (
              <CronRulesEdit {...props} project={project} onChangeTitle={setTitle} />
            )}
          </Fragment>
        ) : (
          <LoadingIndicator />
        )}
      </Layout.Body>
    </Fragment>
  );
}

export default ProjectAlertsEditor;
