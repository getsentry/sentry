import {Fragment, useEffect, useRef} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Member, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {uniqueId} from 'sentry/utils/guid';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import IssueRuleEditor from 'sentry/views/alerts/rules/issue';
import MetricRulesCreate from 'sentry/views/alerts/rules/metric/create';
import MetricRuleDuplicate from 'sentry/views/alerts/rules/metric/duplicate';
import {UptimeAlertForm} from 'sentry/views/alerts/rules/uptime/uptimeAlertForm';
import {AlertRuleType} from 'sentry/views/alerts/types';
import type {
  AlertType as WizardAlertType,
  WizardRuleTemplate,
} from 'sentry/views/alerts/wizard/options';
import {
  AlertWizardAlertNames,
  DEFAULT_WIZARD_TEMPLATE,
} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';
import MonitorForm from 'sentry/views/monitors/components/monitorForm';
import type {Monitor} from 'sentry/views/monitors/types';

type RouteParams = {
  alertType?: AlertRuleType;
  projectId?: string;
};

type Props = RouteComponentProps<RouteParams> & {
  hasMetricAlerts: boolean;
  members: Member[] | undefined;
  organization: Organization;
  project: Project;
};

function Create(props: Props) {
  const {hasMetricAlerts, organization, project, location, members, params, router} =
    props;
  const {
    aggregate,
    dataset,
    eventTypes,
    createFromDuplicate,
    duplicateRuleId,
    createFromDiscover,
    query,
    createFromWizard,
  } = location?.query ?? {};
  const alertType = params.alertType || AlertRuleType.METRIC;

  const sessionId = useRef(uniqueId());
  const navigate = useNavigate();

  const isDuplicateRule = createFromDuplicate === 'true' && duplicateRuleId;

  useEffect(() => {
    // TODO(taylangocmen): Remove redirect with aggregate && dataset && eventTypes, init from template
    if (
      alertType === AlertRuleType.METRIC &&
      !(aggregate && dataset && eventTypes) &&
      !createFromDuplicate
    ) {
      router.replace(
        normalizeUrl({
          ...location,
          pathname: makeAlertsPathname({
            path: `/new/${alertType}/`,
            organization,
          }),
          query: {
            ...location.query,
            ...DEFAULT_WIZARD_TEMPLATE,
            project: project.slug,
          },
        })
      );
    }
  }, [
    alertType,
    aggregate,
    dataset,
    eventTypes,
    createFromDuplicate,
    router,
    location,
    organization.slug,
    project.slug,
    organization,
  ]);

  const {teams, isLoading} = useUserTeams();

  useRouteAnalyticsParams({
    project_id: project.id,
    session_id: sessionId.current,
    alert_type: alertType,
    duplicate_rule: isDuplicateRule ? 'true' : 'false',
    wizard_v3: 'true',
  });
  useRouteAnalyticsEventNames('new_alert_rule.viewed', 'New Alert Rule: Viewed');

  const wizardTemplate: WizardRuleTemplate = {
    aggregate: aggregate ?? DEFAULT_WIZARD_TEMPLATE.aggregate,
    dataset: dataset ?? DEFAULT_WIZARD_TEMPLATE.dataset,
    eventTypes: eventTypes ?? DEFAULT_WIZARD_TEMPLATE.eventTypes,
    query: query ?? DEFAULT_WIZARD_TEMPLATE.query,
  };
  const eventView = createFromDiscover ? EventView.fromLocation(location) : undefined;

  let wizardAlertType: undefined | WizardAlertType;
  if (createFromWizard && alertType === AlertRuleType.METRIC) {
    wizardAlertType = wizardTemplate
      ? getAlertTypeFromAggregateDataset(wizardTemplate)
      : 'issues';
  }

  const title = t('New Alert Rule');

  return (
    <Fragment>
      <SentryDocumentTitle title={title} projectSlug={project.slug} />
      <Layout.Header>
        <Layout.HeaderContent>
          <BuilderBreadCrumbs
            organization={organization}
            alertName={t('Set Conditions')}
            title={wizardAlertType ? t('Select Alert') : title}
            projectSlug={project.slug}
          />
          <Layout.Title>
            {wizardAlertType
              ? `${t('Set Conditions for')} ${AlertWizardAlertNames[wizardAlertType]}`
              : title}
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        {isLoading ? (
          <LoadingIndicator />
        ) : (
          <Fragment>
            {alertType === AlertRuleType.UPTIME ? (
              <UptimeAlertForm {...props} />
            ) : alertType === AlertRuleType.CRONS ? (
              <MonitorForm
                apiMethod="POST"
                apiEndpoint={`/organizations/${organization.slug}/monitors/`}
                onSubmitSuccess={(data: Monitor) =>
                  navigate(
                    makeAlertsPathname({
                      path: `/rules/crons/${data.project.slug}/${data.slug}/details/`,
                      organization,
                    })
                  )
                }
                submitLabel={t('Create')}
              />
            ) : !hasMetricAlerts || alertType === AlertRuleType.ISSUE ? (
              <IssueRuleEditor
                {...props}
                userTeamIds={teams.map(({id}) => id)}
                members={members}
              />
            ) : (
              hasMetricAlerts &&
              alertType === AlertRuleType.METRIC &&
              (isDuplicateRule ? (
                <MetricRuleDuplicate
                  {...props}
                  eventView={eventView}
                  wizardTemplate={wizardTemplate}
                  sessionId={sessionId.current}
                  userTeamIds={teams.map(({id}) => id)}
                />
              ) : (
                <MetricRulesCreate
                  {...props}
                  eventView={eventView}
                  wizardTemplate={wizardTemplate}
                  sessionId={sessionId.current}
                  userTeamIds={teams.map(({id}) => id)}
                />
              ))
            )}
          </Fragment>
        )}
      </Layout.Body>
    </Fragment>
  );
}

export default Create;
