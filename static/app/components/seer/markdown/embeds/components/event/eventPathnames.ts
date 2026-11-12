import {
  IssueDetailsDrawer,
  makeIssueDetailsPath,
} from 'sentry/views/issueDetails/issueDetailsQueryParams';

/**
 * Issue details links for the event embed, built once and passed down.
 */
export function makeEventPath({
  organizationSlug,
  issueId,
  eventId,
}: {
  eventId: string;
  issueId: string;
  organizationSlug: string;
}) {
  return makeIssueDetailsPath({
    organization: {slug: organizationSlug},
    groupId: issueId,
    eventId,
  });
}

export function makeIssueDistributionsPath({
  organizationSlug,
  issueId,
}: {
  issueId: string;
  organizationSlug: string;
}) {
  return makeIssueDetailsPath({
    organization: {slug: organizationSlug},
    groupId: issueId,
    drawer: IssueDetailsDrawer.DISTRIBUTIONS,
  });
}

export function makeIssueTagDistributionPath({
  organizationSlug,
  issueId,
  tagKey,
}: {
  issueId: string;
  organizationSlug: string;
  tagKey: string;
}) {
  return makeIssueDetailsPath({
    organization: {slug: organizationSlug},
    groupId: issueId,
    drawer: IssueDetailsDrawer.DISTRIBUTIONS,
    drawerParams: {tagKey},
  });
}
