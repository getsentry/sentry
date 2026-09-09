import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

/**
 * There is no shared helper for issue event pathnames, so the embed builds them
 * here once and passes the results down. `tags/` is a legacy alias that
 * redirects to `distributions/` -- link at the canonical path directly.
 */
export function makeEventPathname({
  organizationSlug,
  issueId,
  eventId,
}: {
  eventId: string;
  issueId: string;
  organizationSlug: string;
}) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/issues/${issueId}/events/${eventId}/`
  );
}

export function makeIssueDistributionsPathname({
  organizationSlug,
  issueId,
}: {
  issueId: string;
  organizationSlug: string;
}) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/issues/${issueId}/${TabPaths[Tab.DISTRIBUTIONS]}`
  );
}

export function makeIssueTagDistributionPathname({
  organizationSlug,
  issueId,
  tagKey,
}: {
  issueId: string;
  organizationSlug: string;
  tagKey: string;
}) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/issues/${issueId}/${TabPaths[Tab.DISTRIBUTIONS]}${encodeURIComponent(tagKey)}/`
  );
}
