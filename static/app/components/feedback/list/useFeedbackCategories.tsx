import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

type FeedbackCategory = {
  associatedLabels: string[];
  feedbackCount: number;
  primaryLabel: string;
};

type FeedbackCategoriesResponse = {
  categories: FeedbackCategory[] | null;
  numFeedbacksContext: number;
  success: boolean;
};

export function useFeedbackCategories(): {
  categories: FeedbackCategory[] | null;
  isError: boolean;
  isPending: boolean;
  tooFewFeedbacks: boolean;
} {
  const organization = useOrganization();

  const {selection} = usePageFilters();

  const normalizedDateRange = normalizeDateTimeParams(selection.datetime);

  const {data, isPending, isError} = useQuery({
    ...apiOptions.as<FeedbackCategoriesResponse>()(
      '/organizations/$organizationIdOrSlug/feedback-categories/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
        },
        query: {
          ...normalizedDateRange,
          project: selection.projects,
        },
        staleTime: 5000,
      }
    ),
    retry: 1,
  });

  if (isPending) {
    return {
      categories: null,
      isPending: true,
      isError: false,
      tooFewFeedbacks: false,
    };
  }

  if (isError) {
    return {
      categories: null,
      isPending: false,
      isError: true,
      tooFewFeedbacks: false,
    };
  }

  return {
    categories: data.categories,
    isPending: false,
    isError: false,
    tooFewFeedbacks: data.numFeedbacksContext === 0 && !data.success,
  };
}
