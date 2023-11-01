import type {Organization} from 'sentry/types';
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
          `/organizations/${organization.slug}/issues/${feedbackId}/`,
          {
            query: {
              collapse: ['release', 'tags'],
              expand: ['inbox', 'owners'],
            },
          },
        ]
      : undefined,
    eventQueryKey: feedbackId
      ? [`/organizations/${organization.slug}/issues/${feedbackId}/events/latest/`]
      : undefined,
  };
}
