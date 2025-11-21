import * as qs from 'query-string';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export const makeAutomationBasePathname = (orgSlug: string) => {
  return normalizeUrl(`/organizations/${orgSlug}/monitors/alerts/`);
};

export const makeAutomationCreatePathname = (
  orgSlug: string,
  query: {
    connectedIds?: string[];
  } = {}
) => {
  return normalizeUrl(
    `${makeAutomationBasePathname(orgSlug)}new/?${qs.stringify(query)}`
  );
};

export const makeAutomationDetailsPathname = (orgSlug: string, automationId: string) => {
  return normalizeUrl(`${makeAutomationBasePathname(orgSlug)}${automationId}/`);
};

export const makeAutomationEditPathname = (orgSlug: string, automationId: string) => {
  return normalizeUrl(`${makeAutomationBasePathname(orgSlug)}${automationId}/edit/`);
};
