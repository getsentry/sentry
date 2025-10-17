import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export const makeAutomationBasePathname = (orgSlug: string, linkPrefix: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/${linkPrefix}/`);
};

export const makeAutomationDetailsPathname = (
  orgSlug: string,
  automationId: string,
  linkPrefix: string
) => {
  return normalizeUrl(
    `${makeAutomationBasePathname(orgSlug, linkPrefix)}${automationId}/`
  );
};

export const makeAutomationEditPathname = (
  orgSlug: string,
  automationId: string,
  linkPrefix: string
) => {
  return normalizeUrl(
    `${makeAutomationBasePathname(orgSlug, linkPrefix)}${automationId}/edit/`
  );
};
