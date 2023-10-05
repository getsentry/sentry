import styled from '@emotion/styled';
import {Location} from 'history';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {DataSection} from 'sentry/components/events/styles';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {Event, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

interface SpanDiff {
  duration_after: number;
  duration_before: number;
  duration_delta: number;
  freq_after: number;
  freq_before: number;
  freq_delta: number;
  sample_event_id: string;
  score_delta: number;
  span_description: string;
  span_group: string;
  span_op: string;
}

interface UseFetchAdvancedAnalysisProps {
  breakpoint: string;
  end: string;
  projectId: string;
  start: string;
  transaction: string;
}

interface RenderBodyCellProps {
  column: GridColumnOrder<string>;
  end: string;
  location: Location;
  organization: Organization;
  projectId: string;
  row: SpanDiff;
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

function getColumns() {
  return [
    {key: 'span_op', name: t('Operation'), width: COL_WIDTH_UNDEFINED},
    {key: 'span_description', name: t('Description'), width: 400},

    // TODO: Relative Frequency should be replaced with Throughput
    {key: 'freq_after', name: t('Relative Frequency'), width: COL_WIDTH_UNDEFINED},
    {key: 'freq_delta', name: t('Change'), width: COL_WIDTH_UNDEFINED},
    {key: 'duration_after', name: t('P95'), width: COL_WIDTH_UNDEFINED},
    {key: 'duration_delta', name: t('Change'), width: COL_WIDTH_UNDEFINED},
  ];
}

function renderHeadCell(column: GridColumnOrder<string>) {
  if (
    ['freq_after', 'freq_delta', 'duration_after', 'duration_delta'].includes(column.key)
  ) {
    if (column.key === 'freq_after') {
      return (
        <Tooltip
          title={t(
            'Relative Frequency is the number of times the span appeared divided by the number of transactions observed'
          )}
          skipWrapper
        >
          <NumericColumnLabel>{column.name}</NumericColumnLabel>
        </Tooltip>
      );
    }

    return <NumericColumnLabel>{column.name}</NumericColumnLabel>;
  }
  return column.name;
}

function renderBodyCell({
  column,
  row,
  organization,
  transaction,
  projectId,
  location,
  start,
  end,
}: RenderBodyCellProps) {
  if (column.key === 'span_description') {
    const label = row[column.key] || t('unnamed span');
    return (
      <Tooltip title={label} showOnlyOnOverflow>
        <TextOverflow>
          <Link
            to={spanDetailsRouteWithQuery({
              orgSlug: organization.slug,
              spanSlug: {op: row.span_op, group: row.span_group},
              transaction,
              projectID: projectId,
              query: {
                ...location.query,
                statsPeriod: undefined,
                query: undefined,
                start,
                end,
              },
            })}
          >
            {label}
          </Link>
        </TextOverflow>
      </Tooltip>
    );
  }

  if (['duration_delta', 'freq_delta'].includes(column.key)) {
    if (row[column.key] === 0) {
      return <NumericColumnLabel>-</NumericColumnLabel>;
    }

    const prefix = column.key.split('_delta')[0];
    const unitSuffix = prefix === 'duration' ? 'ms' : '';
    const percentDelta = (row[column.key] / row[`${prefix}_before`]) * 100;
    const strippedLabel = Math.abs(percentDelta).toFixed(2);
    const isPositive = percentDelta > 0;

    return (
      <Tooltip
        title={tct('From [before] to [after]', {
          before: `${row[`${prefix}_before`].toFixed(2)}${unitSuffix}`,
          after: `${row[`${prefix}_after`].toFixed(2)}${unitSuffix}`,
        })}
      >
        <ChangeLabel isPositive={isPositive}>{`${
          isPositive ? '+' : '-'
        }${strippedLabel}%`}</ChangeLabel>
      </Tooltip>
    );
  }

  if (typeof row[column.key] === 'number') {
    const unitSuffix = column.key === 'duration_after' ? 'ms' : '';
    return (
      <NumericColumnLabel>{`${row[column.key].toFixed(
        2
      )}${unitSuffix}`}</NumericColumnLabel>
    );
  }

  return row[column.key];
}

function AggregateSpanDiff({event, projectId}: {event: Event; projectId: string}) {
  const location = useLocation();
  const organization = useOrganization();
  const {transaction, requestStart, requestEnd, breakpoint} =
    event?.occurrence?.evidenceData ?? {};

  const start = new Date(requestStart * 1000).toISOString();
  const end = new Date(requestEnd * 1000).toISOString();
  const breakpointTimestamp = new Date(breakpoint * 1000).toISOString();
  const {data, isLoading, isError} = useFetchAdvancedAnalysis({
    transaction,
    start,
    end,
    breakpoint: breakpointTimestamp,
    projectId,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  let content;
  if (isError) {
    content = (
      <EmptyStateWarning>
        <p>{t('Oops! Something went wrong fetching span diffs')}</p>
      </EmptyStateWarning>
    );
  } else if (!defined(data) || data.length === 0) {
    content = (
      <EmptyStateWarning>
        <p>{t('Unable to find significant differences in spans')}</p>
      </EmptyStateWarning>
    );
  } else {
    content = (
      <GridEditable
        isLoading={isLoading}
        data={data}
        location={location}
        columnOrder={getColumns()}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell: (column, row) =>
            renderBodyCell({
              column,
              row,
              organization,
              transaction,
              projectId,
              location,
              start,
              end,
            }),
        }}
      />
    );
  }

  return <DataSection>{content}</DataSection>;
}

export default AggregateSpanDiff;

const ChangeLabel = styled('div')<{isPositive: boolean}>`
  color: ${p => (p.isPositive ? p.theme.red300 : p.theme.green300)};
  text-align: right;
`;

const NumericColumnLabel = styled('div')`
  text-align: right;
  width: 100%;
`;
