import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';

interface Props {
  feedbackId: string;
  organization: Organization;
}

export default function getFeedbackItemQueryKey({feedbackId, organization}: Props): {
  eventQueryKey: ApiQueryKey | undefined;
  issueQueryKey: ApiQueryKey | undefined;
} {
  return {
    issueQueryKey: feedbackId
      ? [
          getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/', {
            path: {organizationIdOrSlug: organization.slug, issueId: feedbackId},
          }),
          {
            query: {
              collapse: ['release', 'tags'],
            },
          },
        ]
      : undefined,
    eventQueryKey: feedbackId
      ? [
          getApiUrl(
            '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
            {
              path: {
                organizationIdOrSlug: organization.slug,
                issueId: feedbackId,
                eventId: 'latest',
              },
            }
          ),
        ]
      : undefined,
  };
}
