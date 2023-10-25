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
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {RateUnits} from 'sentry/utils/discover/fields';
import {NumberContainer} from 'sentry/utils/discover/styles';
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
    {key: 'span_op', name: t('Operation'), width: 200},
    {key: 'span_description', name: t('Description'), width: COL_WIDTH_UNDEFINED},
    {key: 'spm', name: t('Span Frequency'), width: COL_WIDTH_UNDEFINED},
    {key: 'p95', name: t('P95'), width: COL_WIDTH_UNDEFINED},
  ];
}

function getPercentChange(before: number, after: number) {
  return ((after - before) / before) * 100;
}

function renderHeadCell(column: GridColumnOrder<string>) {
  if (['spm', 'p95'].includes(column.key)) {
    return <NumericColumnLabel>{column.name}</NumericColumnLabel>;
  }
  return column.name;
}

function NumericChange({
  columnKey,
  beforeRawValue,
  afterRawValue,
}: {
  afterRawValue: number;
  beforeRawValue: number;
  columnKey: string;
  isDuration?: boolean;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const percentChange = getPercentChange(beforeRawValue, afterRawValue);

  const unit = columnKey === 'p95' ? 'millisecond' : RateUnits.PER_MINUTE;
  const renderer = (value: number) =>
    getFieldRenderer(
      columnKey,
      {
        p95: 'duration',
        spm: 'rate',
      },
      false
    )({[columnKey]: value}, {organization, location, unit});

  if (Math.round(percentChange) !== 0) {
    let percentChangeLabel = `${percentChange > 0 ? '+' : ''}${Math.round(
      percentChange
    )}%`;
    if (beforeRawValue === 0) {
      percentChangeLabel = t('New');
    }
    return (
      <Change>
        {renderer(beforeRawValue)}
        <IconArrow direction="right" size="xs" />
        {renderer(afterRawValue)}
        <ChangeLabel isPositive={percentChange > 0} isNeutral={beforeRawValue === 0}>
          {percentChangeLabel}
        </ChangeLabel>
      </Change>
    );
  }

  return (
    <Change>
      {renderer(afterRawValue)}
      <ChangeDescription>{t('(No significant change)')}</ChangeDescription>
    </Change>
  );
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

  return <DataSection>{content}</DataSection>;
}

export default AggregateSpanDiff;

const ChangeLabel = styled('div')<{isNeutral: boolean; isPositive: boolean}>`
  color: ${p => {
    if (p.isNeutral) {
      return p.theme.gray300;
    }
    if (p.isPositive) {
      return p.theme.red300;
    }
    return p.theme.green300;
  }};
  text-align: right;
`;

const NumericColumnLabel = styled('div')`
  text-align: right;
  width: 100%;
`;

const Change = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  justify-content: right;

  ${NumberContainer} {
    width: unset;
  }
`;

const ChangeDescription = styled('span')`
  color: ${p => p.theme.gray300};
  white-space: nowrap;
`;
