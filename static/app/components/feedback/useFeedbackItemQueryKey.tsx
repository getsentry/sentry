import {useMemo} from 'react';

import type {Organization} from 'sentry/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

interface Props {
  organization: Organization;
}

export default function useFeedbackItemQueryKey({organization}: Props): {
  eventQueryKey: ApiQueryKey | undefined;
  issueQueryKey: ApiQueryKey | undefined;
} {
  const {feedbackSlug} = useLocationQuery({
    fields: {
      feedbackSlug: decodeScalar,
    },
  });

  const [, feedbackId] = feedbackSlug.split(':');

  const issueQueryKey = useMemo((): ApiQueryKey | undefined => {
    if (!feedbackId) {
      return undefined;
    }
    return [
      `/organizations/${organization.slug}/issues/${feedbackId}/`,
      {
        query: {
          collapse: ['release', 'tags'],
          expand: ['inbox', 'owners'],
        },
      },
    ];
  }, [organization, feedbackId]);

  const eventQueryKey = useMemo((): ApiQueryKey | undefined => {
    if (!feedbackId) {
      return undefined;
    }
    return [`/organizations/${organization.slug}/issues/${feedbackId}/events/latest/`];
  }, [organization, feedbackId]);

  return {
    issueQueryKey,
    eventQueryKey,
  };
}
