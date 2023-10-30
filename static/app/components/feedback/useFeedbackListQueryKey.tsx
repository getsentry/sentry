import {useMemo} from 'react';

import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import type {Organization} from 'sentry/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

interface Props {
  organization: Organization;
}

export default function useFeedbackListQueryKey({organization}: Props): ApiQueryKey {
  const queryView = useLocationQuery({
    fields: {
      collapse: ['inbox'],
      expand: [
        'owners', // Gives us assignment
        'stats', // Gives us `firstSeen`
      ],
      limit: 25,
      queryReferrer: 'feedback_list_page',
      shortIdLookup: 0,
      end: decodeScalar,
      environment: decodeList,
      field: decodeList,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
      mailbox: decodeMailbox,
    },
  });

  const queryKey = useMemo(
    (): ApiQueryKey => [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          ...queryView,
          query: `issue.category:feedback status:${queryView.mailbox} ${queryView.query}`,
        },
      },
    ],
    [organization, queryView]
  );

  return queryKey;
}
