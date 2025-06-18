import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export const makeMonitorBasePathname = (orgSlug: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/issues/monitors/`);
};

export const makeMonitorDetailsPathname = (orgSlug: string, monitorId: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/issues/monitors/${monitorId}/`);
};
