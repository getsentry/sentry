import {useMemo, useState} from 'react';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

import {EventRegressionTable} from './eventRegressionTable';

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
      `/organizations/${organization.slug}/events-root-cause-analysis/`,
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

const ADDITIONAL_COLUMNS = [
  {key: 'operation', name: t('Operation'), width: 120},
  {key: 'description', name: t('Description'), width: COL_WIDTH_UNDEFINED},
];

interface AggregateSpanDiffProps {
  event: Event;
  project: Project;
}

function AggregateSpanDiff({event, project}: AggregateSpanDiffProps) {
  const location = useLocation();
  const organization = useOrganization();
  const isSpansOnly = organization.features.includes(
    'statistical-detectors-rca-spans-only'
  );

  const [causeType, setCauseType] = useState<'duration' | 'throughput'>('duration');

  const {transaction, breakpoint} = event?.occurrence?.evidenceData ?? {};
  const breakpointTimestamp = new Date(breakpoint * 1000).toISOString();

  const {start, end} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 7,
    retentionDays: 30,
  });

  const {
    data: rcaData,
    isPending: isRcaLoading,
    isError: isRcaError,
  } = useFetchAdvancedAnalysis({
    transaction,
    start: (start as Date).toISOString(),
    end: (end as Date).toISOString(),
    breakpoint: breakpointTimestamp,
    projectId: project.id,
    enabled: !isSpansOnly,
  });

  // Initialize the search query with has:span.group because only
  // specific operations have their span.group recorded in the span
  // metrics dataset
  const search = new MutableSearch('has:span.group');
  search.addFilterValue('transaction', transaction);

  const {
    data: spansData,
    isPending: isSpansDataLoading,
    isError: isSpansDataError,
  } = useSpanMetrics(
    {
      search,
      fields: [
        'span.op',
        'any(span.description)',
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
    'api.performance.transactions.statistical-detector-root-cause-analysis'
  );

  const tableData = useMemo(() => {
    if (isSpansOnly) {
      return spansData?.map(row => {
        const commonProps = {
          operation: row['span.op'],
          group: row['span.group'],
          description: row['any(span.description)'] || undefined,
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
      });
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
      }) || []
    );
  }, [isSpansOnly, rcaData, spansData, causeType, breakpoint]);

  const tableOptions = useMemo(() => {
    return {
      description: {
        defaultValue: t('(unnamed span)'),
        link: dataRow => ({
          target: spanDetailsRouteWithQuery({
            orgSlug: organization.slug,
            spanSlug: {op: dataRow.operation, group: dataRow.group},
            transaction,
            projectID: project.id,
            query: {
              ...location.query,
              statsPeriod: undefined,
              query: undefined,
              start: (start as Date).toISOString(),
              end: (end as Date).toISOString(),
            },
          }),
        }),
      },
    };
  }, [location, organization, project, transaction, start, end]);

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
            {isSpansOnly ? t('Average Duration') : t('Duration (P95)')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="throughput">
            {t('Throughput')}
          </SegmentedControl.Item>
        </SegmentedControl>
      }
    >
      <EventRegressionTable
        causeType={causeType}
        columns={ADDITIONAL_COLUMNS}
        data={tableData}
        isLoading={isSpansOnly ? isSpansDataLoading : isRcaLoading}
        isError={isSpansOnly ? isSpansDataError : isRcaError}
        options={tableOptions}
      />
    </InterimSection>
  );
}

export default AggregateSpanDiff;
