import {skipToken, useQuery} from '@tanstack/react-query';
import type {Query} from 'history';
import * as qs from 'query-string';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Redirect} from 'sentry/components/redirect';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertWizardRuleTemplates,
  type MetricAlertType,
} from 'sentry/views/alerts/wizard/options';
import {
  makeAutomationBasePathname,
  makeAutomationDetailsPathname,
  makeAutomationEditPathname,
} from 'sentry/views/automations/pathnames';
import {
  makeMonitorBasePathname,
  makeMonitorCreatePathname,
  makeMonitorDetailsPathname,
  makeMonitorEditPathname,
} from 'sentry/views/detectors/pathnames';
import {getMetricMonitorUrl} from 'sentry/views/insights/common/utils/getMetricMonitorUrl';

const DISABLE_LEGACY_ALERT_RULE_REDIRECTS_FEATURE =
  'workflow-engine-disable-legacy-alert-rule-redirects';

export function MonitorsListRedirect() {
  const organization = useOrganization();

  return <Redirect to={makeMonitorBasePathname(organization.slug)} />;
}

export function AutomationsListRedirect() {
  const organization = useOrganization();

  return <Redirect to={makeAutomationBasePathname(organization.slug)} />;
}

interface AlertRuleWorkflow {
  alertRuleId: string | null;
  ruleId: string | null;
  workflowId: string;
}

interface AlertRuleDetector {
  alertRuleId: string | null;
  detectorId: string;
  ruleId: string | null;
}

interface IncidentGroupOpenPeriod {
  groupId: string;
  incidentId: string | null;
  incidentIdentifier: string;
  openPeriodId: string;
}

function getIssueDetailsPath({
  orgSlug,
  groupId,
  openPeriodId,
  query,
}: {
  groupId: string;
  openPeriodId: string | undefined;
  orgSlug: string;
  query: Query;
}) {
  const search = qs.stringify({...query, openPeriod: openPeriodId});
  const pathname = normalizeUrl(`/organizations/${orgSlug}/issues/${groupId}/`);

  return search ? `${pathname}?${search}` : pathname;
}

/**
 * HoC that wraps a component to handle workflow engine
 * redirects for issue alert rules. Fetches workflow data if needed and
 * shows loading state while requests are in flight.
 */
function withRuleRedirect<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  makeRedirectPath: (workflowId: string, orgSlug: string) => string
) {
  return function WorkflowEngineRedirectWrapper(props: P) {
    const organization = useOrganization();
    const {ruleId} = useParams();
    const redirectsDisabled = organization.features.includes(
      DISABLE_LEGACY_ALERT_RULE_REDIRECTS_FEATURE
    );

    const {data: alertRuleWorkflow, isPending} = useQuery({
      ...apiOptions.as<AlertRuleWorkflow>()(
        '/organizations/$organizationIdOrSlug/alert-rule-workflow/',
        {
          path:
            ruleId && !redirectsDisabled
              ? {organizationIdOrSlug: organization.slug}
              : skipToken,
          query: {rule_id: ruleId},
          staleTime: 0,
        }
      ),
      retry: false,
    });

    if (redirectsDisabled) {
      return <Redirect to={makeAutomationBasePathname(organization.slug)} />;
    }

    if (isPending) {
      return <LoadingIndicator />;
    }
    if (alertRuleWorkflow) {
      return (
        <Redirect
          to={makeRedirectPath(alertRuleWorkflow.workflowId, organization.slug)}
        />
      );
    }

    return <Component {...(props as any)} />;
  };
}

/**
 * HoC that wraps a component to handle workflow engine
 * redirects for metric alert rules. Fetches detector data if needed and
 * shows loading state while requests are in flight.
 */
function withAlertRuleRedirect<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  makeRedirectPath: (detectorId: string, orgSlug: string) => string
) {
  return function WorkflowEngineRedirectWrapper(props: P) {
    const organization = useOrganization();
    const {ruleId, detectorId} = useParams();
    const redirectsDisabled = organization.features.includes(
      DISABLE_LEGACY_ALERT_RULE_REDIRECTS_FEATURE
    );

    const {data: alertRuleDetector, isPending} = useQuery({
      ...apiOptions.as<AlertRuleDetector>()(
        '/organizations/$organizationIdOrSlug/alert-rule-detector/',
        {
          path:
            ruleId && !detectorId && !redirectsDisabled
              ? {organizationIdOrSlug: organization.slug}
              : skipToken,
          query: {alert_rule_id: ruleId},
          staleTime: 0,
        }
      ),
      retry: false,
    });

    if (redirectsDisabled) {
      return <Redirect to={makeMonitorBasePathname(organization.slug)} />;
    }

    if (detectorId) {
      return <Redirect to={makeRedirectPath(detectorId, organization.slug)} />;
    }
    if (isPending) {
      return <LoadingIndicator />;
    }
    if (alertRuleDetector) {
      return (
        <Redirect
          to={makeRedirectPath(alertRuleDetector.detectorId, organization.slug)}
        />
      );
    }

    return <Component {...(props as any)} />;
  };
}

export const withAutomationDetailsRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) =>
  withRuleRedirect(Component, (workflowId, orgSlug) =>
    makeAutomationDetailsPathname(orgSlug, workflowId)
  );

export const withAutomationEditRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) =>
  withRuleRedirect(Component, (workflowId, orgSlug) =>
    makeAutomationEditPathname(orgSlug, workflowId)
  );

export const withMetricIssueRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) => {
  return function MetricIssueRedirectWrapper(props: P) {
    const location = useLocation();
    const alertId = location.query.alert as string | undefined;
    const notificationUuid = location.query.notification_uuid;

    const shouldRedirectToIssue = notificationUuid && alertId;

    // We want notification links to redirect to the metric issue details page
    if (shouldRedirectToIssue) {
      return (
        <RedirectToIssue alertId={alertId}>
          <Component {...(props as any)} />
        </RedirectToIssue>
      );
    }

    return <Component {...(props as any)} />;
  };
};

export const withDetectorDetailsRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) => {
  return function WorkflowEngineRedirectWrapper(props: P) {
    const organization = useOrganization();
    const {ruleId, detectorId} = useParams();
    const location = useLocation();
    const alertId = location.query.alert as string | undefined;
    const redirectsDisabled = organization.features.includes(
      DISABLE_LEGACY_ALERT_RULE_REDIRECTS_FEATURE
    );

    if (alertId) {
      return (
        <RedirectToIssue alertId={alertId}>
          <Component {...(props as any)} />
        </RedirectToIssue>
      );
    }

    if (redirectsDisabled) {
      return <Redirect to={makeMonitorBasePathname(organization.slug)} />;
    }

    if (detectorId) {
      return <Redirect to={makeMonitorDetailsPathname(organization.slug, detectorId)} />;
    }

    if (ruleId) {
      return (
        <RedirectToDetector ruleId={ruleId}>
          <Component {...(props as any)} />
        </RedirectToDetector>
      );
    }

    return <Component {...(props as any)} />;
  };
};

function RedirectToIssue({
  alertId,
  children,
}: {
  alertId: string;
  children: React.ReactNode;
}) {
  const organization = useOrganization();
  const location = useLocation();

  const {data: incidentGroupOpenPeriod, isPending: isOpenPeriodPending} =
    useApiQuery<IncidentGroupOpenPeriod>(
      [
        getApiUrl('/organizations/$organizationIdOrSlug/incident-groupopenperiod/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {query: {incident_identifier: alertId}},
      ],
      {
        staleTime: 0,
        enabled: !!alertId,
        retry: false,
      }
    );

  if (isOpenPeriodPending) {
    return <LoadingIndicator />;
  }

  if (incidentGroupOpenPeriod) {
    return (
      <Redirect
        to={getIssueDetailsPath({
          orgSlug: organization.slug,
          groupId: incidentGroupOpenPeriod.groupId,
          openPeriodId: incidentGroupOpenPeriod.openPeriodId,
          query: location.query,
        })}
      />
    );
  }

  return children;
}

function RedirectToDetector({
  ruleId,
  children,
}: {
  children: React.ReactNode;
  ruleId: string;
}) {
  const organization = useOrganization();
  const {data: alertRuleDetector, isPending: isDetectorPending} =
    useApiQuery<AlertRuleDetector>(
      [
        getApiUrl('/organizations/$organizationIdOrSlug/alert-rule-detector/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {query: {alert_rule_id: ruleId}},
      ],
      {
        staleTime: 0,
        retry: false,
      }
    );

  if (isDetectorPending) {
    return <LoadingIndicator />;
  }
  if (alertRuleDetector) {
    return (
      <Redirect
        to={makeMonitorDetailsPathname(organization.slug, alertRuleDetector.detectorId)}
      />
    );
  }
  return children;
}

export const withDetectorEditRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) =>
  withAlertRuleRedirect(Component, (detectorId, orgSlug) =>
    makeMonitorEditPathname(orgSlug, detectorId)
  );

const getDetectionType = (type: string | undefined): string | undefined => {
  switch (type) {
    case 'crons':
      return 'monitor_check_in_failure';
    case 'metric':
      return 'metric_issue';
    case 'uptime':
      return 'uptime_domain_failure';
    default:
      return undefined;
  }
};

function makeCreateRedirectPath(
  orgSlug: string,
  alertType: string | undefined,
  project?: Project
) {
  const search = qs.stringify({
    detectorType: getDetectionType(alertType),
    project: project?.id,
  });

  return search
    ? `${makeMonitorCreatePathname(orgSlug)}?${search}`
    : makeMonitorCreatePathname(orgSlug);
}

function isMonitorableDataset(value: string | undefined): value is Dataset {
  return (
    value !== Dataset.REPLAYS &&
    Object.values<string | undefined>(Dataset).includes(value)
  );
}

function isEventType(value: string): value is EventTypes {
  return Object.values<string>(EventTypes).includes(value);
}

function isMetricAlertType(value: string | undefined): value is MetricAlertType {
  return !!value && Object.hasOwn(AlertWizardRuleTemplates, value);
}

const LEGACY_ALERT_TYPES_BY_WIZARD_OPTION: Record<string, string> = {
  crons_monitor: 'crons',
  uptime_monitor: 'uptime',
};

function makeLegacyCreateRedirectPath({
  alertType,
  organization,
  project,
  query,
}: {
  alertType: string | undefined;
  organization: Organization;
  project: Project | undefined;
  query: Query;
}) {
  // The legacy wizard preselected an alert type from `alert_option`, filling
  // in the dataset and aggregate from its template when none were given.
  const alertOption = decodeScalar(query.alert_option);
  const resolvedAlertType =
    alertType ??
    (alertOption && Object.hasOwn(LEGACY_ALERT_TYPES_BY_WIZARD_OPTION, alertOption)
      ? LEGACY_ALERT_TYPES_BY_WIZARD_OPTION[alertOption]
      : undefined);
  const template = isMetricAlertType(alertOption)
    ? AlertWizardRuleTemplates[alertOption]
    : undefined;

  const dataset = decodeScalar(query.dataset) ?? template?.dataset;
  const isMetricAlert = resolvedAlertType === undefined || resolvedAlertType === 'metric';

  if (!isMetricAlert || !isMonitorableDataset(dataset)) {
    return makeCreateRedirectPath(organization.slug, resolvedAlertType, project);
  }

  const eventTypes = decodeList(query.eventTypes).filter(isEventType);
  const target = getMetricMonitorUrl({
    aggregate: decodeScalar(query.aggregate) ?? template?.aggregate ?? '',
    dataset,
    environment: decodeScalar(query.environment),
    eventTypes: eventTypes.length
      ? eventTypes
      : template
        ? [template.eventTypes]
        : undefined,
    organization,
    project,
    query: query.query === '' ? '' : (decodeScalar(query.query) ?? template?.query),
    referrer: decodeScalar(query.referrer),
  });
  return `${target.pathname}?${qs.stringify(target.query)}`;
}

export function MonitorCreateRedirect() {
  const organization = useOrganization();
  const location = useLocation();
  const {alertType, projectId} = useParams<{alertType?: string; projectId?: string}>();
  const {projects, initiallyLoaded} = useProjects();

  const projectSlugOrId = projectId ?? decodeScalar(location.query.project);
  if (projectSlugOrId && !initiallyLoaded) {
    return <LoadingIndicator />;
  }

  const project = projectSlugOrId
    ? projects.find(p => p.slug === projectSlugOrId || p.id === projectSlugOrId)
    : undefined;

  return (
    <Redirect
      to={makeLegacyCreateRedirectPath({
        alertType,
        organization,
        project,
        query: location.query,
      })}
    />
  );
}

export function UptimeMonitorCreateRedirect() {
  const organization = useOrganization();

  return <Redirect to={makeCreateRedirectPath(organization.slug, 'uptime')} />;
}

export function withOpenPeriodRedirect<P extends Record<string, any>>(
  Component: React.ComponentType<P>
) {
  return function OpenPeriodRedirectWrapper(props: P) {
    const organization = useOrganization();
    const location = useLocation();
    const {alertId} = useParams();

    const {data: incidentGroupOpenPeriod, isPending} =
      useApiQuery<IncidentGroupOpenPeriod>(
        [
          getApiUrl('/organizations/$organizationIdOrSlug/incident-groupopenperiod/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
          {query: {incident_identifier: alertId}},
        ],
        {
          staleTime: 0,
          enabled: !!alertId,
          retry: false,
        }
      );

    if (isPending) {
      return <LoadingIndicator />;
    }
    if (incidentGroupOpenPeriod) {
      return (
        <Redirect
          to={getIssueDetailsPath({
            orgSlug: organization.slug,
            groupId: incidentGroupOpenPeriod.groupId,
            openPeriodId: incidentGroupOpenPeriod.openPeriodId,
            query: location.query,
          })}
        />
      );
    }

    return <Component {...(props as any)} />;
  };
}
