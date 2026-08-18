import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export type ManagedIngestDomainStatus =
  | 'creating'
  | 'pending_dns'
  | 'pending_certificate'
  | 'active'
  | 'error'
  | 'deleting';

export type ManagedIngestDomainDiagnosticStatus = 'passed' | 'failed' | 'waiting';

export type ManagedIngestDomainDiagnosticCheck = {
  dependsOn: string[];
  expected: string | null;
  label: string;
  observed: string | null;
  slug: string;
  status: ManagedIngestDomainDiagnosticStatus;
  summary: string;
};

export type ManagedIngestDomain = {
  activatedAt: string | null;
  certificateStatus: string | null;
  cnameTarget: string | null;
  dateCreated: string;
  dateUpdated: string;
  diagnostics: {
    checks: ManagedIngestDomainDiagnosticCheck[];
    ranAt: string | null;
  };
  dnsProvider: 'cloudflare' | null;
  hostname: string;
  id: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  projectId: string;
  provider: string;
  providerHostnameId: string | null;
  providerStatus: string | null;
  status: ManagedIngestDomainStatus;
  verificationErrors: string[];
};

export type ManagedIngestDomainResponse = {
  domain: ManagedIngestDomain | null;
};

type ManagedIngestDomainApiOptionsParameters = {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
};

export const MANAGED_INGEST_DOMAIN_ENDPOINT =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/managed-ingest-domain/' as const;
export const MANAGED_INGEST_DOMAIN_POLL_INTERVAL = 5_000;

export function shouldPollManagedIngestDomain(
  status: ManagedIngestDomainStatus | undefined
): boolean {
  return (
    status === 'creating' ||
    status === 'pending_dns' ||
    status === 'pending_certificate' ||
    status === 'deleting'
  );
}

export function getManagedIngestDisplayDsn(
  dsn: string,
  organizationId: Organization['id']
): string {
  const url = new URL(dsn);
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    return dsn;
  }

  url.protocol = 'https:';
  url.host = `o${organizationId}.ingest.sentry.io`;
  url.port = '';
  return url.toString();
}

export function managedIngestDomainApiOptions({
  orgSlug,
  projectSlug,
}: ManagedIngestDomainApiOptionsParameters) {
  return apiOptions.as<ManagedIngestDomainResponse>()(MANAGED_INGEST_DOMAIN_ENDPOINT, {
    path: {
      organizationIdOrSlug: orgSlug,
      projectIdOrSlug: projectSlug,
    },
    staleTime: MANAGED_INGEST_DOMAIN_POLL_INTERVAL,
  });
}
