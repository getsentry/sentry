import {useMemo} from 'react';

import type {Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

interface Props {
  organization: Organization;
}

const MAILBOX = {
  unresolved: 'is:unassigned is:unresolved',
  resolved: 'is:unassigned is:resolved',
  ignored: 'is:unassigned is:ignored',
};

export default function useMailboxCounts({organization}: Props) {
  const queryView = useLocationQuery({
    fields: {
      end: decodeScalar,
      environment: decodeList,
      field: decodeList,
      project: decodeList,
      query: Object.values(MAILBOX),
      queryReferrer: 'feedback_list_page',
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });

  const {data = {}, ...result} = useApiQuery(
    [
      `/organizations/${organization.slug}/issues-count/`,
      {
        query: queryView,
      },
    ],
    {
      staleTime: 1_000,
      refetchInterval: 30_000,
    }
  );

  return useMemo(
    () => ({
      ...result,
      data: data
        ? {
            unresolved: data[MAILBOX.unresolved],
            resolved: data[MAILBOX.resolved],
            ignored: data[MAILBOX.ignored],
          }
        : undefined,
    }),
    [result, data]
  );
}
