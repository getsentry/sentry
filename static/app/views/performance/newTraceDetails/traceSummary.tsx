import type React from 'react';

// import {LoadingIndicator} from 'react-select/src/components/indicators';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';

export interface TraceSummaryData {
  key_observations: string;
  performance_characteristics: string;
  suggested_investigations: string;
  summary: string;
  trace_id: string;
}

const makeTraceSummaryQueryKey = (
  organizationSlug: string,
  traceSlug: string
): ApiQueryKey => [
  `/organizations/${organizationSlug}/trace-summary/`,
  {method: 'POST', data: {traceSlug}},
];

export function useTraceSummary(traceSlug: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryKey = makeTraceSummaryQueryKey(organization.slug, traceSlug);

  // console.log(organization);

  // console.log('Attempting to fetch data POST');
  const {data, isLoading, isFetching, isError, refetch} = useApiQuery<TraceSummaryData>(
    queryKey,
    {
      staleTime: Infinity,
      enabled: true,
    }
  );

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: [`/organizations/${organization.slug}/trace-summary/`],
      exact: false,
    });
    refetch();
  };

  return {
    data,
    isPending: isLoading || isFetching,
    isError,
    refresh,
  };
}

export function TraceSummarySection({traceSlug}: {traceSlug: string}) {
  // console.log(traceSlug);
  return (
    <InterimSection
      key="trace-summary"
      type={TraceContextSectionKeys.SUMMARY}
      title={t('Trace Summary')}
      data-test-id="trace-summary-section"
      initialCollapse={false}
    >
      <TraceSummaryContent traceSlug={traceSlug} />
    </InterimSection>
  );
}

function TraceSummaryContent({traceSlug}: {traceSlug: string}) {
  const traceContent = useTraceSummary(traceSlug);
  // console.log(traceContent);

  if (traceContent.isPending) {
    return <LoadingIndicator />;
  }

  return (
    <div>
      <h6>Overview:</h6>
      <p>{traceContent.data?.summary}</p>
      <h6>Key Observations:</h6>
      <p>{traceContent.data?.key_observations}</p>
      <h6>Performance Characteristics:</h6>
      <p>{traceContent.data?.performance_characteristics}</p>
      <h6>Suggested Investigations:</h6>
      <p>{traceContent.data?.suggested_investigations}</p>
    </div>
  );
}
