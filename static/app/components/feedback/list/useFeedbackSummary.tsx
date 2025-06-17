// import {useMemo} from 'react';

// import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
// import coaleseIssueStatsPeriodQuery from 'sentry/utils/feedback/coaleseIssueStatsPeriodQuery';
import {useApiQuery} from 'sentry/utils/queryClient';
// import {decodeList, decodeScalar} from 'sentry/utils/queryString';
// import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type FeedbackSummaryResponse = {
  numFeedbacksUsed: number;
  success: boolean;
  summary: string | null;
};

export default function useFeedbackSummary(): {
  isError: boolean;
  isPending: boolean;
  summary: string | null;
  tooFewFeedbacks: boolean;
} {
  // const queryView = useLocationQuery({
  //   fields: {
  //     end: decodeScalar,
  //     project: decodeList,
  //     start: decodeScalar,
  //     statsPeriod: decodeScalar,
  //     utc: decodeScalar,
  //   },
  // });

  const organization = useOrganization();

  const {selection} = usePageFilters();

  // const {listHeadTime} = useFeedbackQueryKeys();

  // console.log(
  //   'these are the selection.datetime, selection.projects',
  //   selection.datetime,
  //   selection.projects
  // );

  // console.log(
  //   'and this is the normalized datetime',
  //   normalizeDateTimeParams(selection.datetime)
  // );

  const normalizedDateRange = normalizeDateTimeParams(selection.datetime);

  // This is similar to what is done in useMailboxCounts.tsx, we can't use useFeedbackSummary in feedbackListPage.tsx because we require the FeedbackQueryKeys context to be present to be able to parse the start/end date
  // const {listHeadTime} = useFeedbackQueryKeys();

  // const queryViewWithStatsPeriod = useMemo(() => {
  //   return coaleseIssueStatsPeriodQuery({
  //     defaultStatsPeriod: '0d',
  //     listHeadTime,
  //     prefetch: false,
  //     queryView,
  //   });
  // }, [listHeadTime, queryView]);

  const {data, isPending, isError} = useApiQuery<FeedbackSummaryResponse>(
    [
      `/organizations/${organization.slug}/feedback-summary/`,
      {
        query: {
          // ...queryViewWithStatsPeriod,
          ...normalizedDateRange,
          project: selection.projects,
        },
      },
    ],
    {
      staleTime: 5000,
      enabled:
        Boolean(normalizedDateRange) &&
        organization.features.includes('user-feedback-ai-summaries'),
      retry: 1,
    }
  );

  if (isPending) {
    return {
      summary: null,
      isPending: true,
      isError: false,
      tooFewFeedbacks: false,
    };
  }

  if (isError) {
    return {
      summary: null,
      isPending: false,
      isError: true,
      tooFewFeedbacks: false,
    };
  }

  return {
    summary: data.summary,
    isPending: false,
    isError: false,
    tooFewFeedbacks: data.numFeedbacksUsed === 0 && data.success === false,
  };
}
