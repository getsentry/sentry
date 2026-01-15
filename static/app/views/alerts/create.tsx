import {Fragment, useEffect, useRef} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {uniqueId} from 'sentry/utils/guid';
import {decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import {useAlertBuilderOutlet} from 'sentry/views/alerts/builder/projectProvider';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import IssueRuleEditor from 'sentry/views/alerts/rules/issue';
import MetricRulesCreate from 'sentry/views/alerts/rules/metric/create';
import MetricRuleDuplicate from 'sentry/views/alerts/rules/metric/duplicate';
import type {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
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
import MonitorForm from 'sentry/views/insights/crons/components/monitorForm';
import type {Monitor} from 'sentry/views/insights/crons/types';

type RouteParams = {
  alertType?: AlertRuleType;
  projectId?: string;
};

export default function Create() {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<RouteParams>();
  const router = useRouter();
  const {project, members} = useAlertBuilderOutlet();
  const hasMetricAlerts = organization.features.includes('incidents');

  const aggregate = decodeScalar(location.query.aggregate);
  const dataset = decodeScalar(location.query.dataset) as Dataset | undefined;
  const createFromDuplicate = decodeScalar(location.query.createFromDuplicate);
  const duplicateRuleId = decodeScalar(location.query.duplicateRuleId);
  const createFromDiscover = decodeScalar(location.query.createFromDiscover);
  const query = decodeScalar(location.query.query);
  const createFromWizard = decodeScalar(location.query.createFromWizard);
  const eventTypes = decodeScalar(location.query.eventTypes) as EventTypes | undefined;

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
      ? getAlertTypeFromAggregateDataset({
          ...wizardTemplate,
          eventTypes: [wizardTemplate.eventTypes],
          organization,
        })
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
              <UptimeAlertForm />
            ) : alertType === AlertRuleType.CRONS ? (
              <MonitorForm
                apiMethod="POST"
                apiEndpoint={`/organizations/${organization.slug}/monitors/`}
                onSubmitSuccess={(data: Monitor) => {
                  trackAnalytics('cron_monitor.created', {
                    organization,
                    cron_schedule_type: data.config.schedule_type,
                  });
                  navigate(
                    makeAlertsPathname({
                      path: `/rules/crons/${data.project.slug}/${data.slug}/details/`,
                      organization,
                    })
                  );
                }}
                submitLabel={t('Create')}
              />
            ) : !hasMetricAlerts || alertType === AlertRuleType.ISSUE ? (
              <IssueRuleEditor
                location={location}
                params={params}
                router={router}
                routes={[]}
                route={{}}
                routeParams={params}
                project={project}
                userTeamIds={teams.map(({id}) => id)}
                members={members}
              />
            ) : (
              hasMetricAlerts &&
              alertType === AlertRuleType.METRIC &&
              (isDuplicateRule ? (
                <MetricRuleDuplicate
                  location={location}
                  params={params}
                  router={router}
                  routes={[]}
                  route={{}}
                  routeParams={params}
                  project={project}
                  eventView={eventView}
                  wizardTemplate={wizardTemplate}
                  sessionId={sessionId.current}
                  userTeamIds={teams.map(({id}) => id)}
                />
              ) : (
                <MetricRulesCreate
                  location={location}
                  params={params}
                  router={router}
                  routes={[]}
                  route={{}}
                  routeParams={params}
                  organization={organization}
                  project={project}
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
