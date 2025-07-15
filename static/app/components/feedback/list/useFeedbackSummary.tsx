import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {useApiQuery} from 'sentry/utils/queryClient';
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
  const organization = useOrganization();

  const {selection} = usePageFilters();

  const normalizedDateRange = normalizeDateTimeParams(selection.datetime);

  const {data, isPending, isError} = useApiQuery<FeedbackSummaryResponse>(
    [
      `/organizations/${organization.slug}/feedback-summary/`,
      {
        query: {
          ...normalizedDateRange,
          project: selection.projects,
        },
      },
    ],
    {
      staleTime: 5000,
      enabled:
        Boolean(normalizedDateRange) &&
        organization.features.includes('user-feedback-ai-summaries') &&
        organization.features.includes('gen-ai-features'),
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
    tooFewFeedbacks: data.numFeedbacksUsed === 0 && !data.success,
  };
}
