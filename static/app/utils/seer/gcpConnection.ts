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
  return status in GCP_STATUS_VARIANTS;
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
  'gcpProjectId' | 'connectionStatus'
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

function getServiceLabel(service: string): string {
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

export function getFailedServices(project: GcpProjectResult): GcpServiceResult[] {
  return project.services.filter(service => service.status !== 'connected');
}

export function describeService(service: GcpServiceResult): string {
  return `${getServiceLabel(service.service)}: ${
    service.errorDetail ?? getStatusLabel(service.status)
  }`;
}

export function parseGcpProjectIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
    ),
  ];
}
