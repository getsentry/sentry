import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export const makeAutomationBasePathname = (orgSlug: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/issues/automations/`);
};

export const makeAutomationDetailsPathname = (orgSlug: string, automationId: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/issues/automations/${automationId}/`);
};
