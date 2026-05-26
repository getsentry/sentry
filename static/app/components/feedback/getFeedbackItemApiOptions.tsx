import {skipToken} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {FeedbackEvent, FeedbackIssue} from 'sentry/utils/feedback/types';

interface Props {
  feedbackId: string;
  organization: Organization;
}

export type FeedbackItemApiOptions = {
  eventApiOptions: ReturnType<typeof feedbackEventApiOptions>;
  issueApiOptions: ReturnType<typeof feedbackIssueApiOptions>;
};

function feedbackIssueApiOptions(orgSlug: string, feedbackId: string) {
  return apiOptions.as<FeedbackIssue>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/',
    {
      path: feedbackId ? {organizationIdOrSlug: orgSlug, issueId: feedbackId} : skipToken,
      query: {collapse: ['release', 'tags', 'stats']},
      staleTime: 0,
    }
  );
}

function feedbackEventApiOptions(orgSlug: string, feedbackId: string) {
  return apiOptions.as<FeedbackEvent>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
    {
      path: feedbackId
        ? {
            organizationIdOrSlug: orgSlug,
            issueId: feedbackId,
            eventId: 'latest',
          }
        : skipToken,
      query: {collapse: ['fullRelease']},
      staleTime: 0,
    }
  );
}

export function getFeedbackItemApiOptions({
  feedbackId,
  organization,
}: Props): FeedbackItemApiOptions {
  return {
    issueApiOptions: feedbackIssueApiOptions(organization.slug, feedbackId),
    eventApiOptions: feedbackEventApiOptions(organization.slug, feedbackId),
  };
}
