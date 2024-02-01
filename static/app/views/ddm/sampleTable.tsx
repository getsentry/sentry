import {Fragment, useCallback, useState} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
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
import type {MetricCorrelation, SelectionRange} from 'sentry/utils/metrics/types';
import {useCorrelatedSamples} from 'sentry/utils/metrics/useMetricsCodeLocations';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import ColorBar from 'sentry/views/performance/vitalDetail/colorBar';

/**
 * Limits the number of spans to the top n + an "other" entry
 */
function sortAndLimitSpans(samples: MetricCorrelation['spansSummary'], limit: number) {
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

interface SamplesTableProps extends SelectionRange {
  highlightedRow?: string | null;
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

export function SampleTable({
  mri,
  highlightedRow,
  onRowHover,
  ...metricMetaOptions
}: SamplesTableProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  const [columnOrder, setColumnOrder] = useState(defaultColumnOrder);

  const {data, isFetching} = useCorrelatedSamples(mri, metricMetaOptions);

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

  const rows = data?.metrics
    .map(m => m.metricSpans)
    .flat()
    .filter(Boolean)
    // We only want to show the first 10 correlations
    .slice(0, 10) as MetricCorrelation[];

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

  function renderBodyCell(col: Column, row: MetricCorrelation) {
    const {key} = col;
    if (!row[key]) {
      return <AlignCenter>{'\u2014'}</AlignCenter>;
    }

    const project = projects.find(p => parseInt(p.id, 10) === row.projectId);
    const highlighted = row.transactionId === highlightedRow;

    if (key === 'transactionId') {
      return (
        <BodyCell
          rowId={row.transactionId}
          onHover={onRowHover}
          highlighted={highlighted}
        >
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
        </BodyCell>
      );
    }
    if (key === 'segmentName') {
      return (
        <BodyCell
          rowId={row.transactionId}
          onHover={onRowHover}
          highlighted={highlighted}
        >
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
        </BodyCell>
      );
    }
    if (key === 'duration') {
      // We get duration in miliseconds, but getDuration expects seconds
      return (
        <BodyCell
          rowId={row.transactionId}
          onHover={onRowHover}
          highlighted={highlighted}
        >
          {getDuration(row.duration / 1000, 2, true)}
        </BodyCell>
      );
    }
    if (key === 'traceId') {
      return (
        <BodyCell
          rowId={row.transactionId}
          onHover={onRowHover}
          highlighted={highlighted}
        >
          <Link
            to={normalizeUrl(
              `/organizations/${organization.slug}/performance/trace/${row.traceId}/`
            )}
            onClick={() => trackClick('trace-id')}
          >
            {row.traceId.slice(0, 8)}
          </Link>
        </BodyCell>
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

      const preparedSpans = sortAndLimitSpans(row.spansSummary, 5);

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
        <BodyCell
          rowId={row.transactionId}
          onHover={onRowHover}
          highlighted={highlighted}
        >
          <Tooltip title={row.timestamp} showOnlyOnOverflow>
            <TextOverflow>
              <DateTime date={row.timestamp} />
            </TextOverflow>
          </Tooltip>
        </BodyCell>
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

    return (
      <BodyCell rowId={row.transactionId} onHover={onRowHover} highlighted={highlighted}>
        {row[col.key]}
      </BodyCell>
    );
  }

  return (
    <Wrapper>
      <GridEditable
        isLoading={isFetching}
        columnOrder={columnOrder}
        columnSortBy={[]}
        data={rows}
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
}

function BodyCell({children, rowId, highlighted, onHover}: any) {
  const handleMouseOver = useCallback(() => {
    onHover(rowId);
  }, [onHover, rowId]);

  const handleMouseOut = useCallback(() => {
    onHover(null);
  }, [onHover]);

  return (
    <BodyCellWrapper
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      highlighted={highlighted}
    >
      {children}
    </BodyCellWrapper>
  );
}

const Wrapper = styled('div')`
  tr:hover {
    td {
      background: ${p => p.theme.backgroundSecondary};
    }
  }
`;

const BodyCellWrapper = styled('span')<{highlighted?: boolean}>``;

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
