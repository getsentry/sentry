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
import {t} from 'sentry/locale';
import {Event, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {NumericChange, renderHeadCell} from 'sentry/utils/performance/regression/table';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

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
    {key: 'span_op', name: t('Span Operation'), width: 200},
    {key: 'span_description', name: t('Description'), width: COL_WIDTH_UNDEFINED},
    {key: 'spm', name: t('Span Frequency'), width: COL_WIDTH_UNDEFINED},
    {key: 'p95', name: t('P95'), width: COL_WIDTH_UNDEFINED},
  ];
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

  if (['p95', 'spm'].includes(column.key)) {
    const beforeRawValue = row[`${column.key}_before`];
    const afterRawValue = row[`${column.key}_after`];
    return (
      <NumericChange
        columnKey={column.key}
        beforeRawValue={beforeRawValue}
        afterRawValue={afterRawValue}
      />
    );
  }

  return row[column.key];
}

function AggregateSpanDiff({event, projectId}: {event: Event; projectId: string}) {
  const location = useLocation();
  const organization = useOrganization();
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
              start: (start as Date).toISOString(),
              end: (end as Date).toISOString(),
            }),
        }}
      />
    );
  }

  return (
    <DataSection>
      <strong>{t('Span Analysis:')}</strong>
      {content}
    </DataSection>
  );
}

export default AggregateSpanDiff;
