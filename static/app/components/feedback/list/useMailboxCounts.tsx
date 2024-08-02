import {useMemo} from 'react';

import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import type {Organization} from 'sentry/types/organization';
import coaleseIssueStatsPeriodQuery from 'sentry/utils/feedback/coaleseIssueStatsPeriodQuery';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';

interface Props {
  organization: Organization;
}

// The keys here are the different search terms that we're using:
type ApiReturnType = Record<string, number>;

// This is what the hook consumer gets:
type HookReturnType = {
  ignored: number;
  resolved: number;
  unresolved: number;
};

export default function useMailboxCounts({
  organization,
}: Props): UseApiQueryResult<HookReturnType, RequestError> {
  const location = useLocation();
  const locationQuery = decodeScalar(location.query.query, '');
  const {listHeadTime} = useFeedbackQueryKeys();

  // We should fetch the counts while taking the query into account
  const MAILBOX: Record<keyof HookReturnType, keyof ApiReturnType> = {
    unresolved: 'issue.category:feedback is:unassigned is:unresolved ' + locationQuery,
    resolved: 'issue.category:feedback is:unassigned is:resolved ' + locationQuery,
    ignored: 'issue.category:feedback is:unassigned is:ignored ' + locationQuery,
  };

  const mailboxQuery = Object.values(MAILBOX);

  const queryView = useLocationQuery({
    fields: {
      end: decodeScalar,
      environment: decodeList,
      field: decodeList,
      project: decodeList,
      query: mailboxQuery,
      queryReferrer: 'feedback_mailbox_count',
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });

  const queryViewWithStatsPeriod = useMemo(
    () =>
      coaleseIssueStatsPeriodQuery({
        defaultStatsPeriod: '0d',
        listHeadTime,
        prefetch: false,
        queryView,
      }),
    [listHeadTime, queryView]
  );

  const result = useApiQuery<ApiReturnType>(
    [
      `/organizations/${organization.slug}/issues-count/`,
      {query: queryViewWithStatsPeriod},
    ],
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
    [result, MAILBOX.ignored, MAILBOX.resolved, MAILBOX.unresolved]
  );
}
