// import {useEffect, useMemo, useRef, useState} from 'react';

import {useMemo} from 'react';

import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import coaleseIssueStatsPeriodQuery from 'sentry/utils/feedback/coaleseIssueStatsPeriodQuery';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';

type FeedbackSummaryResponse = {
  num_feedbacks_used: number;
  success: boolean;
  summary: string | null;
};

export default function useFeedbackSummary(): {
  error: Error | null;
  loading: boolean;
  summary: string | null;
} {
  // const [response, setResponse] = useState<string | null>(null);
  // const [loading, setLoading] = useState(false);
  // const [error, setError] = useState<Error | null>(null);
  // const requestMadeRef = useRef(false);
  // const prevIsHelpfulRef = useRef<boolean | null>(isHelpful);

  // const finalResultRef = useRef<{
  //   keySentiments: Sentiment[];
  //   summary: string | null;
  // }>({
  //   summary: null,
  //   keySentiments: [],
  // });

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

  // This is similar to what is done in useMailboxCounts.tsx
  const {listHeadTime} = useFeedbackQueryKeys();

  const queryViewWithStatsPeriod = useMemo(() => {
    return coaleseIssueStatsPeriodQuery({
      defaultStatsPeriod: '0d',
      listHeadTime,
      prefetch: false,
      queryView,
    });
  }, [listHeadTime, queryView]);

  const {
    data: feedbackSummaryData,
    isPending: isFeedbackSummaryLoading,
    isError: isFeedbackSummaryError,
    error: feedbackSummaryError,
  } = useApiQuery<FeedbackSummaryResponse>(
    [
      `/organizations/${organization.slug}/feedback-summary/`,
      {
        query: {
          ...queryViewWithStatsPeriod,
        },
      },
    ],
    {staleTime: 5000, enabled: Boolean(queryViewWithStatsPeriod)}
  );

  // useEffect(() => {
  //   // Refetch when isHelpful changes to false
  //   const shouldRefetch = isHelpful === false && prevIsHelpfulRef.current !== isHelpful;

  //   if (shouldRefetch) {
  //     requestMadeRef.current = false;
  //   }

  //   prevIsHelpfulRef.current = isHelpful;

  //   if (!apiKey || !messages.length || requestMadeRef.current) {
  //     return;
  //   }

  //   setLoading(true);
  //   setError(null);
  //   requestMadeRef.current = true;

  //   getSentimentSummary({messages, apiKey})
  //     .then(result => {
  //       setResponse(result);
  //     })
  //     .catch(err => {
  //       setError(
  //         err instanceof Error ? err : new Error('Failed to get sentiment summary')
  //       );
  //     })
  //     .finally(() => {
  //       setLoading(false);
  //     });

  // }, [apiKey, messages, isHelpful, queryView, organization]);

  if (isFeedbackSummaryLoading) {
    return {
      summary: null,
      loading: true,
      error: null,
    };
  }

  if (isFeedbackSummaryError) {
    return {
      summary: null,
      loading: false,
      error: feedbackSummaryError,
    };
  }

  return {
    summary: feedbackSummaryData.summary,
    loading: false,
    error: null,
  };
}
