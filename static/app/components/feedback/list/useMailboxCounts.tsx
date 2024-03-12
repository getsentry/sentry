import {useMemo} from 'react';

import type {Organization} from 'sentry/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

interface Props {
  organization: Organization;
}

// The keys here are the different search terms that we're using:
type ApiReturnType = {
  'issue.category:feedback is:unassigned is:ignored': number;
  'issue.category:feedback is:unassigned is:resolved': number;
  'issue.category:feedback is:unassigned is:unresolved': number;
};

// This is what the hook consumer gets:
type HookReturnType = {
  ignored: number;
  resolved: number;
  unresolved: number;
};

// This is the type to describe the mapping from ApiResponse to hook result:
const MAILBOX: Record<keyof HookReturnType, keyof ApiReturnType> = {
  unresolved: 'issue.category:feedback is:unassigned is:unresolved',
  resolved: 'issue.category:feedback is:unassigned is:resolved',
  ignored: 'issue.category:feedback is:unassigned is:ignored',
};

export default function useMailboxCounts({
  organization,
}: Props): UseApiQueryResult<HookReturnType, RequestError> {
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

  const result = useApiQuery<ApiReturnType>(
    [`/organizations/${organization.slug}/issues-count/`, {query: queryView}],
    {
      staleTime: 1_000,
      refetchInterval: 30_000,
    }
  );

  return useMemo(
    () =>
      ({
        ...result,
        data: result.data
          ? {
              unresolved: result.data[MAILBOX.unresolved],
              resolved: result.data[MAILBOX.resolved],
              ignored: result.data[MAILBOX.ignored],
            }
          : undefined,
      }) as UseApiQueryResult<HookReturnType, RequestError>,
    [result]
  );
}
