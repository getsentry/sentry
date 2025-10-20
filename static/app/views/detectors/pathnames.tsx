import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export const makeMonitorBasePathname = (orgSlug: string, linkPrefix: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/${linkPrefix}/`);
};

export const makeMonitorDetailsPathname = (
  orgSlug: string,
  monitorId: string,
  linkPrefix: string
) => {
  return normalizeUrl(`${makeMonitorBasePathname(orgSlug, linkPrefix)}${monitorId}/`);
};

export const makeMonitorCreatePathname = (orgSlug: string, linkPrefix: string) => {
  return normalizeUrl(`${makeMonitorBasePathname(orgSlug, linkPrefix)}new/`);
};
