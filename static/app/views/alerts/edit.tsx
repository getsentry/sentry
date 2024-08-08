import {Fragment, useState} from 'react';
import type {RouteComponentProps} from 'react-router';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Member, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import IssueEditor from 'sentry/views/alerts/rules/issue';
import {MetricRulesEdit} from 'sentry/views/alerts/rules/metric/edit';
import {AlertRuleType} from 'sentry/views/alerts/types';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  hasMetricAlerts: boolean;
  members: Member[] | undefined;
  organization: Organization;
  project: Project;
};

function ProjectAlertsEditor(props: Props) {
  const {hasMetricAlerts, members, organization, project} = props;
  const location = useLocation();

  const [title, setTitle] = useState('');

  const alertType = location.pathname.includes('/alerts/metric-rules/')
    ? AlertRuleType.METRIC
    : AlertRuleType.ISSUE;

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
            {(!hasMetricAlerts || alertType === AlertRuleType.ISSUE) && (
              <IssueEditor
                {...props}
                project={project}
                onChangeTitle={setTitle}
                userTeamIds={teams.map(({id}) => id)}
                members={members}
              />
            )}
            {hasMetricAlerts && alertType === AlertRuleType.METRIC && (
              <MetricRulesEdit
                {...props}
                project={project}
                onChangeTitle={setTitle}
                userTeamIds={teams.map(({id}) => id)}
              />
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
