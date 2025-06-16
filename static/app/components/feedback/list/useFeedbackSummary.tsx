import {useMemo} from 'react';

import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import coaleseIssueStatsPeriodQuery from 'sentry/utils/feedback/coaleseIssueStatsPeriodQuery';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';

type FeedbackSummaryResponse = {
  numFeedbacksUsed: number;
  success: boolean;
  summary: string | null;
};

export default function useFeedbackSummary(): {
  error: Error | null;
  isPending: boolean;
  summary: string | null;
  tooFewFeedbacks: boolean | null;
} {
  const queryView = useLocationQuery({
    fields: {
      end: decodeScalar,
      project: decodeList,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });

  const organization = useOrganization();

  // This is similar to what is done in useMailboxCounts.tsx, we can't use useFeedbackSummary in feedbackListPage.tsx because we require the FeedbackQueryKeys context to be present to be able to parse the start/end date
  const {listHeadTime} = useFeedbackQueryKeys();

  const queryViewWithStatsPeriod = useMemo(() => {
    return coaleseIssueStatsPeriodQuery({
      defaultStatsPeriod: '0d',
      listHeadTime,
      prefetch: false,
      queryView,
    });
  }, [listHeadTime, queryView]);

  const {data, isPending, isError, error} = useApiQuery<FeedbackSummaryResponse>(
    [
      `/organizations/${organization.slug}/feedback-summary/`,
      {
        query: {
          ...queryViewWithStatsPeriod,
        },
      },
    ],
    {staleTime: 5000, enabled: Boolean(queryViewWithStatsPeriod), retry: 1}
  );

  if (isPending) {
    return {
      summary: null,
      isPending: true,
      error: null,
      tooFewFeedbacks: false,
    };
  }

  if (isError) {
    return {
      summary: null,
      isPending: false,
      error,
      tooFewFeedbacks: false,
    };
  }

  return {
    summary: data.summary,
    isPending: false,
    error: null,
    tooFewFeedbacks: data.numFeedbacksUsed === 0 && data.success === false,
  };
}
