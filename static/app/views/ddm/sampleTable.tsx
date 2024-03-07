import {Fragment, memo, useCallback, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {PlatformIcon} from 'platformicons';
import * as qs from 'query-string';

import {LinkButton} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import type {
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconArrow, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MRI} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDuration} from 'sentry/utils/formatters';
import {getMetricsCorrelationSpanUrl} from 'sentry/utils/metrics';
import type {MetricCorrelation, SpanSummary} from 'sentry/utils/metrics/types';
import {useMetricSamples} from 'sentry/utils/metrics/useMetricsCorrelations';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import type {SelectionRange} from 'sentry/views/ddm/chart/types';
import ColorBar from 'sentry/views/performance/vitalDetail/colorBar';

/**
 * Limits the number of spans to the top n + an "other" entry
 */
function sortAndLimitSpans(samples?: SpanSummary[], limit: number = 5) {
  if (!samples) {
    return [];
  }

  const sortedSpans = [...samples].sort((a, b) => b.spanDuration - a.spanDuration);

  return sortedSpans.slice(0, limit).concat([
    {
      spanDuration: sortedSpans
        .slice(limit)
        .reduce((acc, span) => acc + span.spanDuration, 0),
      spanOp: `+${sortedSpans.length - limit} more`,
    },
  ]);
}

export interface SamplesTableProps extends SelectionRange {
  mri?: MRI;
  onRowHover?: (sampleId?: string) => void;
  query?: string;
}

type Column = GridColumnHeader<keyof MetricCorrelation>;

const defaultColumnOrder: GridColumnOrder<keyof MetricCorrelation>[] = [
  {key: 'transactionId', width: COL_WIDTH_UNDEFINED, name: 'Event ID'},
  {key: 'segmentName', width: COL_WIDTH_UNDEFINED, name: 'Transaction'},
  {key: 'spansNumber', width: COL_WIDTH_UNDEFINED, name: 'Number of Spans'},
  {key: 'spansSummary', width: COL_WIDTH_UNDEFINED, name: 'Spans Summary'},
  {key: 'duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'},
  {key: 'traceId', width: COL_WIDTH_UNDEFINED, name: 'Trace ID'},
  {key: 'timestamp', width: COL_WIDTH_UNDEFINED, name: 'Timestamp'},
  {key: 'profileId', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
];

export const SampleTable = memo(function InnerSampleTable({
  mri,
  onRowHover,
  ...metricMetaOptions
}: SamplesTableProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  const [columnOrder, setColumnOrder] = useState(defaultColumnOrder);

  const {data, isFetching} = useMetricSamples(mri, metricMetaOptions);

  const handleColumnResize = useCallback(
    (columnIndex: number, nextColumn: GridColumn) => {
      setColumnOrder(prevColumnOrder => {
        const newColumnOrder = [...prevColumnOrder];
        newColumnOrder[columnIndex] = {
          ...newColumnOrder[columnIndex],
          width: nextColumn.width,
        };
        return newColumnOrder;
      });
    },
    [setColumnOrder]
  );

  function trackClick(target: 'event-id' | 'transaction' | 'trace-id' | 'profile') {
    trackAnalytics('ddm.sample-table-interaction', {
      organization,
      target,
    });
  }

  function renderHeadCell(col: Column) {
    if (col.key === 'profileId') {
      return <AlignCenter>{col.name}</AlignCenter>;
    }
    if (col.key === 'duration') {
      return (
        <DurationHeadCell>
          {col.name}
          <IconArrow size="xs" direction="down" />
        </DurationHeadCell>
      );
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(col: Column, row: MetricCorrelation): React.ReactNode {
    const {key} = col;
    if (!row[key]) {
      return <AlignCenter>{'\u2014'}</AlignCenter>;
    }

    const project = projects.find(p => parseInt(p.id, 10) === row.projectId);

    if (key === 'transactionId') {
      return (
        <Link
          to={getMetricsCorrelationSpanUrl(
            organization,
            project?.slug,
            row.spansDetails[0]?.spanId,
            row.transactionId,
            row.transactionSpanId
          )}
          onClick={() => trackClick('event-id')}
          target="_blank"
        >
          {row.transactionId.slice(0, 8)}
        </Link>
      );
    }
    if (key === 'segmentName') {
      return (
        <TextOverflow>
          <Tooltip title={project?.slug}>
            <StyledPlatformIcon platform={project?.platform || 'default'} />
          </Tooltip>
          <Link
            to={normalizeUrl(
              `/organizations/${organization.slug}/performance/summary/?${qs.stringify({
                ...extractSelectionParameters(location.query),
                project: project?.id,
                transaction: row.segmentName,
                referrer: 'metrics',
              })}`
            )}
            onClick={() => trackClick('transaction')}
          >
            {row.segmentName}
          </Link>
        </TextOverflow>
      );
    }
    if (key === 'duration') {
      // We get duration in miliseconds, but getDuration expects seconds
      return getDuration(row.duration / 1000, 2, true);
    }
    if (key === 'traceId') {
      return (
        <Link
          to={normalizeUrl(
            `/organizations/${organization.slug}/performance/trace/${row.traceId}/`
          )}
          onClick={() => trackClick('trace-id')}
        >
          {row.traceId.slice(0, 8)}
        </Link>
      );
    }
    if (key === 'spansSummary') {
      const totalDuration =
        row.spansSummary?.reduce(
          (acc, spanSummary) => acc + spanSummary.spanDuration,
          0
        ) ?? 0;

      if (totalDuration === 0) {
        return <NoValue>{t('(no value)')}</NoValue>;
      }

      const preparedSpans = sortAndLimitSpans(row.spansSummary);

      return (
        <StyledColorBar
          colorStops={preparedSpans.map((spanSummary, i) => {
            return {
              color: CHART_PALETTE[4][i % CHART_PALETTE.length],
              percent: (spanSummary.spanDuration / totalDuration) * 100,
              renderBarStatus: (barStatus, barKey) => (
                <Tooltip
                  title={
                    <Fragment>
                      <div>{spanSummary.spanOp}</div>
                      <div>
                        <Duration
                          seconds={spanSummary.spanDuration / 1000}
                          fixedDigits={2}
                          abbreviation
                        />
                      </div>
                    </Fragment>
                  }
                  key={barKey}
                  skipWrapper
                >
                  {barStatus}
                </Tooltip>
              ),
            };
          })}
        />
      );
    }
    if (key === 'timestamp') {
      return (
        <Tooltip title={row.timestamp} showOnlyOnOverflow>
          <TextOverflow>
            <DateTime date={row.timestamp} />
          </TextOverflow>
        </Tooltip>
      );
    }
    if (key === 'profileId') {
      return (
        <AlignCenter>
          <Tooltip title={t('View Profile')}>
            <LinkButton
              to={normalizeUrl(
                `/organizations/${organization.slug}/profiling/profile/${project?.slug}/${row.profileId}/flamegraph/`
              )}
              onClick={() => trackClick('profile')}
              size="xs"
            >
              <IconProfiling size="xs" />
            </LinkButton>
          </Tooltip>
        </AlignCenter>
      );
    }

    // TODO(TS): The types here indicate it could be an object
    return row[col.key] as React.ReactNode;
  }

  const wrapperRef = useRef<HTMLDivElement>(null);
  const currentHoverIdRef = useRef<string | null>(null);

  // TODO(aknaus): Clean up by adding propper event listeners to the grid component
  const handleMouseMove = useMemo(
    () =>
      debounce((event: React.MouseEvent) => {
        const wrapper = wrapperRef.current;
        const target = event.target;

        if (!wrapper || !(target instanceof Element)) {
          onRowHover?.(undefined);
          currentHoverIdRef.current = null;
          return;
        }

        const tableRow = (target as Element).closest('tbody >tr');
        if (!tableRow) {
          onRowHover?.(undefined);
          currentHoverIdRef.current = null;
          return;
        }

        const rows = Array.from(wrapper.querySelectorAll('tbody > tr'));
        const rowIndex = rows.indexOf(tableRow);
        const rowId = data?.[rowIndex]?.transactionId;

        if (!rowId) {
          onRowHover?.(undefined);
          currentHoverIdRef.current = null;
          return;
        }
        if (currentHoverIdRef.current !== rowId) {
          onRowHover?.(rowId);
          currentHoverIdRef.current = rowId;
        }
      }, 10),
    [data, onRowHover]
  );

  return (
    <Wrapper
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onRowHover?.(undefined)}
      isEmpty={!data?.length}
    >
      <GridEditable
        isLoading={isFetching}
        columnOrder={columnOrder}
        columnSortBy={[]}
        data={data ?? []}
        grid={{
          renderHeadCell,
          renderBodyCell,
          onResizeColumn: handleColumnResize,
        }}
        emptyMessage={mri ? t('No samples found') : t('Choose a metric to display data.')}
        location={location}
      />
    </Wrapper>
  );
});

const Wrapper = styled('div')<{isEmpty?: boolean}>`
  tr:hover {
    td {
      background: ${p => (p.isEmpty ? 'none' : p.theme.backgroundSecondary)};
    }
  }
`;

const AlignCenter = styled('span')`
  display: block;
  margin: auto;
  text-align: center;
  width: 100%;
`;

const DurationHeadCell = styled('span')`
  display: flex;
  gap: ${space(0.25)};
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  margin-right: ${space(1)};
  height: ${space(3)};
`;

const StyledColorBar = styled(ColorBar)`
  margin-bottom: 0px;
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
