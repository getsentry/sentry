import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type PageSummary = {
  keyObservations: string;
  performanceCharacteristics: string;
  suggestedInvestigations: SuggestedInvestigation[];
  summary: string;
};

type SuggestedInvestigation = {
  explanation: string;
  referenceUrl: string | null;
  spanId: string;
  spanOp: string;
  suggestions: string[];
  traceId: string;
};

export function usePageSummary(
  traceSlugs: string[],
  options: Partial<UseApiQueryOptions<PageSummary>> = {}
) {
  const organization = useOrganization();
  return useApiQuery<PageSummary>(
    [
      `/organizations/${organization.slug}/page-web-vitals-summary/`,
      {
        data: {
          traceSlugs,
        },
        method: 'POST',
      },
    ],
    {
      staleTime: 0,
      retry: false,
      ...options,
    }
  );
}
