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
  tooFewFeedbacks: boolean | null;
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

  // This is similar to what is done in useMailboxCounts.tsx, and is also why we can't use useFeedbackSummary in feedbackListPage.tsx
  const {listHeadTime} = useFeedbackQueryKeys();

  const queryViewWithStatsPeriod = useMemo(() => {
    return coaleseIssueStatsPeriodQuery({
      defaultStatsPeriod: '0d',
      listHeadTime,
      prefetch: false,
      queryView,
    });
  }, [listHeadTime, queryView]);

  // console.log('queryViewWithStatsPeriod', queryViewWithStatsPeriod);

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
    {staleTime: 5000, enabled: Boolean(queryViewWithStatsPeriod), retry: 1} // Only retry once if the request fails
  );

  if (isFeedbackSummaryLoading) {
    return {
      summary: null,
      loading: true,
      error: null,
      tooFewFeedbacks: false,
    };
  }

  if (isFeedbackSummaryError) {
    return {
      summary: null,
      loading: false,
      error: feedbackSummaryError,
      tooFewFeedbacks: null,
    };
  }

  return {
    summary: feedbackSummaryData.summary,
    loading: false,
    error: null,
    tooFewFeedbacks: feedbackSummaryData.num_feedbacks_used === 0,
  };
}
