import {useMemo, useState} from 'react';

import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields} from 'sentry/views/insights/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

import {EventRegressionTable, type EventRegressionTableRow} from './eventRegressionTable';

interface SpanDiff {
  p95_after: number;
  p95_before: number;
  score: number;
  span_description: string;
  span_group: string;
  span_op: string;
  spm_after: number;
  spm_before: number;
}

interface UseFetchAdvancedAnalysisProps {
  breakpoint: string;
  enabled: boolean;
  end: string;
  projectId: string;
  start: string;
  transaction: string;
}

function useFetchAdvancedAnalysis({
  transaction,
  start,
  end,
  breakpoint,
  projectId,
  enabled,
}: UseFetchAdvancedAnalysisProps) {
  const organization = useOrganization();
  return useApiQuery<SpanDiff[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events-root-cause-analysis/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          transaction,
          project: projectId,
          start,
          end,
          breakpoint,
          per_page: 10,
        },
      },
    ],
    {
      staleTime: 60000,
      retry: false,
      enabled,
    }
  );
}

interface AggregateSpanDiffProps {
  event: Event;
  project: Project;
}

export function AggregateSpanDiff({event, project}: AggregateSpanDiffProps) {
  const organization = useOrganization();
  const location = useLocation();
  const isSpansOnly = organization.features.includes(
    'statistical-detectors-rca-spans-only'
  );

  const [causeType, setCauseType] = useState<'duration' | 'throughput'>('duration');

  const {transaction, breakpoint} = event?.occurrence?.evidenceData ?? {};

  const {start, end} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 7,
    retentionDays: 30,
  });
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Initialize the search query with has:span.group because only
  // specific operations have their span.group recorded in the span
  // metrics dataset
  const search = useMemo(() => {
    const spanSearch = new MutableSearch('has:span.group');
    spanSearch.addFilterValue('transaction', transaction);
    return spanSearch.formatString();
  }, [transaction]);

  const {
    data: spansData,
    isPending: isSpansDataLoading,
    isError: isSpansDataError,
    error: spansError,
  } = useSpans(
    {
      search,
      fields: [
        'span.op',
        'span.description',
        'span.group',
        `regression_score(span.self_time,${breakpoint})`,
        `avg_by_timestamp(span.self_time,less,${breakpoint})`,
        `avg_by_timestamp(span.self_time,greater,${breakpoint})`,
        `epm_by_timestamp(less,${breakpoint})`,
        `epm_by_timestamp(greater,${breakpoint})`,
      ],
      sorts: [{field: `regression_score(span.self_time,${breakpoint})`, kind: 'desc'}],
      limit: 10,
      enabled: isSpansOnly,
    },
    'api.insights.transactions.statistical-detector-root-cause-analysis'
  );

  const {
    data: rcaData,
    isPending: isRcaLoading,
    error: rcaError,
  } = useFetchAdvancedAnalysis({
    transaction,
    start: startISO,
    end: endISO,
    breakpoint: new Date(breakpoint * 1000).toISOString(),
    projectId: project.id,
    enabled: !isSpansOnly || isSpansDataError,
  });

  // The spans dataset may reject some legacy RCA fields/functions for certain orgs.
  // When that happens, fall back to the RCA endpoint so this section still renders.
  const shouldUseSpansData = isSpansOnly && !isSpansDataError;

  const tableData = useMemo(() => {
    if (shouldUseSpansData) {
      return (
        spansData?.map(row => {
          const commonProps = {
            operation: row['span.op'],
            group: row['span.group'],
            description: row['span.description'] || undefined,
          };

          if (causeType === 'throughput') {
            const throughputBefore = row[`epm_by_timestamp(less,${breakpoint})`]!;
            const throughputAfter = row[`epm_by_timestamp(greater,${breakpoint})`]!;
            return {
              ...commonProps,
              throughputBefore,
              throughputAfter,
              percentageChange: throughputAfter / throughputBefore - 1,
            };
          }

          const durationBefore =
            row[`avg_by_timestamp(span.self_time,less,${breakpoint})`]! / 1e3;
          const durationAfter =
            row[`avg_by_timestamp(span.self_time,greater,${breakpoint})`]! / 1e3;
          return {
            ...commonProps,
            durationBefore,
            durationAfter,
            percentageChange: durationAfter / durationBefore - 1,
          };
        }) ?? []
      );
    }

    return (
      rcaData?.map(row => {
        if (causeType === 'throughput') {
          return {
            operation: row.span_op,
            group: row.span_group,
            description: row.span_description,
            throughputBefore: row.spm_before,
            throughputAfter: row.spm_after,
            percentageChange: row.spm_after / row.spm_before - 1,
          };
        }

        return {
          operation: row.span_op,
          group: row.span_group,
          description: row.span_description,
          durationBefore: row.p95_before / 1e3,
          durationAfter: row.p95_after / 1e3,
          percentageChange: row.p95_after / row.p95_before - 1,
        };
      }) ?? []
    );
  }, [shouldUseSpansData, rcaData, spansData, causeType, breakpoint]);

  const getDescriptionLink = (dataRow: EventRegressionTableRow) =>
    getSearchInExploreTargetForSpanDiff({
      organization,
      projectIds: project.id,
      transaction,
      spanOp: dataRow.operation,
      spanDescription: dataRow.description ?? '',
      start: startISO,
      end: endISO,
      environment: location.query.environment,
    });

  return (
    <InterimSection
      type={SectionKey.REGRESSION_POTENTIAL_CAUSES}
      title={t('Potential Causes')}
      actions={
        <SegmentedControl
          size="xs"
          aria-label={t('Duration or Throughput')}
          value={causeType}
          onChange={setCauseType}
        >
          <SegmentedControl.Item key="duration">
            {shouldUseSpansData ? t('Average Duration') : t('Duration (P95)')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="throughput">
            {t('Throughput')}
          </SegmentedControl.Item>
        </SegmentedControl>
      }
    >
      <EventRegressionTable
        causeType={causeType}
        data={tableData}
        isLoading={shouldUseSpansData ? isSpansDataLoading : isRcaLoading}
        error={shouldUseSpansData ? spansError : rcaError}
        onDescriptionLink={getDescriptionLink}
      />
    </InterimSection>
  );
}

const getSearchInExploreTargetForSpanDiff = ({
  organization,
  projectIds,
  transaction,
  spanOp,
  spanDescription,
  start,
  end,
  environment,
}: {
  end: string;
  environment: string | string[] | null | undefined;
  organization: Organization;
  projectIds: string | string[] | undefined;
  spanDescription: string;
  spanOp: string;
  start: string;
  transaction: string;
}) => {
  const search = new MutableSearch('');
  search.addFilterValue(SpanFields.TRANSACTION, transaction);
  search.addFilterValue(SpanFields.SPAN_OP, spanOp);
  search.addFilterValue(SpanFields.SPAN_DESCRIPTION, spanDescription);

  return {
    pathname: makeTracesPathname({
      organization,
      path: '/',
    }),
    query: {
      start,
      end,
      environment,
      statsPeriod: undefined,
      query: search.formatString(),
      project: projectIds,
    },
  };
};
