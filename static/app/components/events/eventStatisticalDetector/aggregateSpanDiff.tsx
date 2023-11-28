import {useMemo, useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {Event, Project} from 'sentry/types';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
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

  const [causeType, setCauseType] = useState<'duration' | 'throughput'>('duration');

  const {transaction, breakpoint} = event?.occurrence?.evidenceData ?? {};
  const breakpointTimestamp = new Date(breakpoint * 1000).toISOString();

  const {start, end} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 7,
    retentionDays: 30,
  });
  const {data, isLoading, isError} = useFetchAdvancedAnalysis({
    transaction,
    start: (start as Date).toISOString(),
    end: (end as Date).toISOString(),
    breakpoint: breakpointTimestamp,
    projectId: project.id,
  });

  const tableData = useMemo(() => {
    return (
      data?.map(row => {
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
  }, [data, causeType]);

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
    <EventDataSection
      type="potential-causes"
      title={t('Potential Causes')}
      actions={
        <SegmentedControl
          size="xs"
          aria-label={t('Duration or Throughput')}
          value={causeType}
          onChange={setCauseType}
        >
          <SegmentedControl.Item key="duration">
            {t('Duration (P95)')}
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
        isLoading={isLoading}
        isError={isError}
        // renderers={renderers}
        options={tableOptions}
      />
    </EventDataSection>
  );
}

export default AggregateSpanDiff;
