import {useMemo, useState} from 'react';

import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields} from 'sentry/views/insights/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

import {EventRegressionTable} from './eventRegressionTable';

const ADDITIONAL_COLUMNS = [
  {key: 'operation', name: t('Operation'), width: 120},
  {key: 'description', name: t('Description'), width: COL_WIDTH_UNDEFINED},
];

interface AggregateSpanDiffProps {
  event: Event;
  project: Project;
}

function AggregateSpanDiff({event, project}: AggregateSpanDiffProps) {
  const organization = useOrganization();
  const [causeType, setCauseType] = useState<'duration' | 'throughput'>('duration');

  const {transaction, breakpoint} = event?.occurrence?.evidenceData ?? {};

  const {start, end} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 7,
    retentionDays: 30,
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
  } = useSpans(
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
    },
    'api.insights.transactions.statistical-detector-root-cause-analysis'
  );

  const tableData = useMemo(() => {
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
  }, [spansData, causeType, breakpoint]);

  const tableOptions = useMemo(() => {
    return {
      description: {
        defaultValue: t('(unnamed span)'),
        link: (dataRow: any) => ({
          target: getSearchInExploreTargetForSpanDiff(
            organization,
            project.id,
            transaction,
            dataRow.operation,
            dataRow.group,
            (start as Date).toISOString(),
            (end as Date).toISOString()
          ),
        }),
      },
    };
  }, [organization, project, transaction, start, end]);

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
            {t('Average Duration')}
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
        isLoading={isSpansDataLoading}
        isError={isSpansDataError}
        options={tableOptions}
      />
    </InterimSection>
  );
}

const getSearchInExploreTargetForSpanDiff = (
  organization: Organization,
  projectIds: string | string[] | undefined,
  transaction: string,
  spanOp: string,
  spanGroup: string,
  start: string,
  end: string
) => {
  const search = new MutableSearch('');
  search.addFilterValue(SpanFields.TRANSACTION, transaction);
  search.addFilterValue(SpanFields.IS_TRANSACTION, 'true');
  search.addFilterValue(SpanFields.SPAN_OP, spanOp);
  search.addFilterValue(SpanFields.SPAN_GROUP, spanGroup);

  return {
    pathname: makeTracesPathname({
      organization,
      path: '/',
    }),
    query: {
      start,
      end,
      statsPeriod: undefined,
      query: search.formatString(),
      project: projectIds,
    },
  };
};

export default AggregateSpanDiff;
