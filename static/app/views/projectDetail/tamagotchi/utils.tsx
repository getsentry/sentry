import {Project, Release} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';
import {CombinedAlertType, CombinedMetricIssueAlerts} from 'sentry/views/alerts/types';

export function useIssues(project?: Project) {
  const total = useIssuesQuery(project, {statsPeriod: '3d'});

  const assigned = useIssuesQuery(project, {
    statsPeriod: '3d',
    query: 'is:assigned is:unresolved',
  });

  const resolved = useIssuesQuery(project, {
    statsPeriod: '3d',
    query: 'is:resolved',
  });

  const issues = {assigned, resolved, total};
  return issues;
}

function useIssuesQuery(project?: Project, query?: Record<string, any>): number {
  const organization = useOrganization();
  const {getResponseHeader} = useApiQuery<any>(
    [`/organizations/${organization.slug}/issues/?project=${project?.id}`, {query}],
    {
      staleTime: Infinity,
    }
  );
  return parseInt(getResponseHeader?.('X-Hits') ?? '0', 10);
}

export function useAlertRules() {
  const organization = useOrganization();
  const location = useLocation();
  const {query} = location;

  query.expand = ['latestIncident', 'lastTriggered'];

  if (!query.sort) {
    query.sort = ['incident_status', 'date_triggered'];
  }
  return useApiQuery<CombinedMetricIssueAlerts[]>(
    [
      `/organizations/${organization.slug}/combined-rules/`,
      {
        query,
      },
    ],
    {staleTime: Infinity}
  );
}

export function getTidiness(
  releases?: Release[],
  project?: Project
): {hasEnvironments: boolean; hasReleases: boolean; tidiness: number} {
  const hasReleases = releases?.length !== 0;
  const hasEnvironments = Boolean(
    project?.environments &&
      project.environments.length > 0 &&
      !(project.environments.length === 1 && project.environments.includes('prod'))
  );

  const tidiness = {hasReleases, hasEnvironments, tidiness: 0};

  if ((hasReleases && !hasEnvironments) || (!hasReleases && hasEnvironments)) {
    tidiness.tidiness = 0.5;
  }
  if (hasReleases && hasEnvironments) {
    tidiness.tidiness = 1;
  }

  return tidiness;
}

export function getEnergy(alerts?: CombinedMetricIssueAlerts[]): {
  energy: number;
  hasIssueAlerts: boolean;
  hasMetricAlerts: boolean;
} {
  const metricAlerts = alerts?.filter(function (element) {
    return element.type === CombinedAlertType.METRIC;
  });

  const issueAlerts = alerts?.filter(function (element) {
    return element.type === CombinedAlertType.ISSUE;
  });

  const hasIssueAlerts = Boolean(issueAlerts && issueAlerts.length > 0);
  const hasMetricAlerts = Boolean(metricAlerts && metricAlerts.length > 0);
  const energy = {hasIssueAlerts, hasMetricAlerts, energy: 0};

  if ((hasIssueAlerts && !hasMetricAlerts) || (!hasMetricAlerts && hasIssueAlerts)) {
    energy.energy = 0.5;
  }
  if (hasIssueAlerts && hasMetricAlerts) {
    energy.energy = 1;
  }

  return energy;
}

export function getHealth(
  project: Project,
  projectsdkupdates: ReturnType<typeof useProjectSdkUpdates>
): {health: number; minifiedStackTraceIsHealthy: boolean; sdkIsHealthy: boolean} {
  let minifiedStackTraceIsHealthy = false;
  let sdkIsHealthy = false;
  if (projectsdkupdates.type === 'resolved') {
    sdkIsHealthy = !projectsdkupdates.data;
  }
  if (project.hasMinifiedStackTrace) {
    minifiedStackTraceIsHealthy = true;
  }
  const health = {sdkIsHealthy, minifiedStackTraceIsHealthy, health: 0};
  if (sdkIsHealthy && minifiedStackTraceIsHealthy) {
    health.health = 1;
  }
  if (sdkIsHealthy || minifiedStackTraceIsHealthy) {
    health.health = 0.5;
  }

  return health;
}

export function getJoy({
  assigned,
  resolved,
  total,
}: {
  assigned: number;
  resolved: number;
  total: number;
}) {
  if (total === 0) {
    return {
      percentAssigned: 1,
      percentResolved: 1,
      joy: 1,
    };
  }
  const percentAssigned = assigned / total;
  const percentResolved = resolved / total;
  const joy = percentAssigned + percentResolved;

  return {
    percentAssigned,
    percentResolved,
    joy,
  };
}
