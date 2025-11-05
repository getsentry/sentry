import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export const makeAutomationBasePathname = (orgSlug: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/monitors/alerts/`);
};

export const makeAutomationDetailsPathname = (orgSlug: string, automationId: string) => {
  return normalizeUrl(`${makeAutomationBasePathname(orgSlug)}${automationId}/`);
};

export const makeAutomationEditPathname = (orgSlug: string, automationId: string) => {
  return normalizeUrl(`${makeAutomationBasePathname(orgSlug)}${automationId}/edit/`);
};
