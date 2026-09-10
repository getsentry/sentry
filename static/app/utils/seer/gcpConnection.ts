import {t} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';

/**
 * Status of a GCP connection, per project and per service.
 *
 * Keep in sync with GCP_CONNECTION_STATUSES in
 * src/sentry/integrations/gcp/utils.py, which in turn mirrors ConnectionStatus
 * in seer/automation/agent/mcp/gcp_verification.py.
 */
const GCP_STATUS_VARIANTS = {
  connected: 'success',
  unverified: 'muted',
  permission_denied: 'danger',
  api_disabled: 'warning',
  project_not_found: 'danger',
  error: 'danger',
} as const satisfies Record<string, 'success' | 'muted' | 'warning' | 'danger'>;

type GcpConnectionStatus = keyof typeof GCP_STATUS_VARIANTS;

type GcpStatusVariant = (typeof GCP_STATUS_VARIANTS)[GcpConnectionStatus];

function isKnownStatus(status: string): status is GcpConnectionStatus {
  return Object.hasOwn(GCP_STATUS_VARIANTS, status);
}

/** One MCP server's result, as returned by Seer's verification endpoint. */
export interface GcpServiceResult {
  service: string;
  status: string;
  errorDetail?: string | null;
}

/** One project's result, aggregated across its services. */
export interface GcpProjectResult {
  connectionStatus: string;
  gcpProjectId: string;
  services: GcpServiceResult[];
  errorDetail?: string | null;
}

export interface GcpVerifyConnectionResponse {
  connectionStatus: string;
  projects: GcpProjectResult[];
  errorDetail?: string | null;
}

interface GcpProjectVerification extends Pick<
  GcpProjectResult,
  'gcpProjectId' | 'connectionStatus' | 'services'
> {
  errorDetail: string | null;
}

export interface GcpVerificationInput extends Pick<
  GcpVerifyConnectionResponse,
  'connectionStatus'
> {
  projects: GcpProjectVerification[];
}

export function getStatusVariant(status: string): GcpStatusVariant {
  return isKnownStatus(status) ? GCP_STATUS_VARIANTS[status] : 'danger';
}

export function getStatusLabel(status: string): string {
  if (!isKnownStatus(status)) {
    return t('Error');
  }
  switch (status) {
    case 'connected':
      return t('Connected');
    case 'unverified':
      return t('Not verified');
    case 'permission_denied':
      return t('Permission denied');
    case 'api_disabled':
      return t('API disabled');
    case 'project_not_found':
      return t('Project not found');
    case 'error':
      return t('Error');
    default:
      return unreachable(status);
  }
}

export function getServiceLabel(service: string): string {
  switch (service) {
    case 'logging':
      return t('Cloud Logging');
    case 'monitoring':
      return t('Cloud Monitoring');
    case 'cloudtrace':
      return t('Cloud Trace');
    default:
      return service;
  }
}

export function buildGcpVerifyPayload(
  configData: Record<string, unknown> | null | undefined
): {customerSaEmail: string; gcpProjectIds: string[]} | null {
  const customerSaEmail = configData?.customer_sa_email;
  const projectIds = configData?.projects;
  if (typeof customerSaEmail !== 'string' || !Array.isArray(projectIds)) {
    return null;
  }

  const gcpProjectIds = [
    ...new Set(projectIds.map(id => String(id).trim()).filter(Boolean)),
  ];
  if (!customerSaEmail || !gcpProjectIds.length) {
    return null;
  }

  return {customerSaEmail, gcpProjectIds};
}

export interface GcpStoredProjectResult {
  connection_status: string;
  error_detail: string | null;
  gcp_project_id: string;
  services: Array<{
    error_detail: string | null;
    service: string;
    status: string;
  }>;
}

export function getGcpProjectResults(
  projects: GcpStoredProjectResult[]
): GcpProjectResult[] {
  return projects.map(project => ({
    gcpProjectId: project.gcp_project_id,
    connectionStatus: project.connection_status,
    errorDetail: project.error_detail,
    services: project.services.map(service => ({
      service: service.service,
      status: service.status,
      errorDetail: service.error_detail,
    })),
  }));
}

export interface GcpErrorGroup {
  detail: string;
  key: string;
  projects: Array<{gcpProjectId: string; services: string[]}>;
  status: string;
}

function getErrorGuidance(status: string): string {
  switch (status) {
    case 'permission_denied':
      return t(
        "The project may not exist, or your service account may not have the required access. Check the project ID and the service account's permissions."
      );
    case 'api_disabled':
      return t('Enable the affected Google Cloud APIs for this project, then re-test.');
    case 'project_not_found':
      return t('Check the project ID and make sure your service account can access it.');
    case 'unverified':
      return t('Run a connection check to verify access.');
    default:
      return t("Sentry couldn't complete verification. Re-test the connection.");
  }
}

export function getGcpErrorGroups(result: GcpVerifyConnectionResponse): GcpErrorGroup[] {
  const groups = new Map<string, GcpErrorGroup>();
  function add(status: string, detail: string, projectId?: string, service?: string) {
    const key = JSON.stringify([status, detail]);
    let group = groups.get(key);
    if (!group) {
      group = {key, status, detail, projects: []};
      groups.set(key, group);
    }
    if (projectId === undefined) {
      return;
    }
    let project = group.projects.find(item => item.gcpProjectId === projectId);
    if (!project) {
      project = {gcpProjectId: projectId, services: []};
      group.projects.push(project);
    }
    if (service && !project.services.includes(service)) {
      project.services.push(service);
    }
  }

  for (const project of result.projects) {
    if (['connected', 'unverified'].includes(project.connectionStatus)) {
      continue;
    }
    const failures = project.services.filter(service => service.status !== 'connected');
    for (const service of failures) {
      add(
        service.status,
        service.errorDetail?.trim() || getErrorGuidance(service.status),
        project.gcpProjectId,
        service.service
      );
    }
    const detail = project.errorDetail?.trim();
    if (detail) {
      // Authentication failures can repeat the project explanation on every service.
      if (
        !failures.some(
          service =>
            service.status === project.connectionStatus &&
            service.errorDetail?.trim() === detail
        )
      ) {
        add(project.connectionStatus, detail, project.gcpProjectId);
      }
    } else if (!failures.length) {
      add(
        project.connectionStatus,
        getErrorGuidance(project.connectionStatus),
        project.gcpProjectId
      );
    }
  }

  const overallDetail = result.errorDetail?.trim();
  if (
    overallDetail &&
    ![...groups.values()].some(
      group => group.status === result.connectionStatus && group.detail === overallDetail
    )
  ) {
    add(result.connectionStatus, overallDetail);
  }
  if (!groups.size && !['connected', 'unverified'].includes(result.connectionStatus)) {
    add(result.connectionStatus, getErrorGuidance(result.connectionStatus));
  }

  const serviceOrder = ['logging', 'monitoring', 'cloudtrace'];
  for (const group of groups.values()) {
    for (const project of group.projects) {
      project.services.sort((a, b) => {
        const aIndex = serviceOrder.indexOf(a);
        const bIndex = serviceOrder.indexOf(b);
        return (
          (aIndex === -1 ? serviceOrder.length : aIndex) -
            (bIndex === -1 ? serviceOrder.length : bIndex) || a.localeCompare(b)
        );
      });
    }
  }
  return [...groups.values()];
}
