import {ReactNode} from 'react';
import {Location, LocationDescriptor, Query} from 'history';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {ColumnType, fieldAlignment} from 'sentry/utils/discover/fields';
import {formatFloat, formatPercentage} from 'sentry/utils/formatters';
import {SuspectSpan} from 'sentry/utils/performance/suspectSpans/types';

import {PerformanceDuration} from '../../utils';

import {
  emptyValue,
  HeaderItem,
  LowerPanel,
  SpanDurationBar,
  SpanLabelContainer,
  UpperPanel,
} from './styles';
import {
  SpanSortOption,
  SpanSortOthers,
  SpanSortPercentiles,
  SpansTotalValues,
  SuspectSpanDataRow,
  SuspectSpanTableColumn,
  SuspectSpanTableColumnKeys,
} from './types';
import {getSuspectSpanSortFromEventView} from './utils';

const SPANS_TABLE_COLUMN_ORDER: SuspectSpanTableColumn[] = [
  {
    key: 'id',
    name: t('Example Transaction'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spanDuration',
    name: t('Span Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'occurrences',
    name: t('Occurrences'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'cumulativeDuration',
    name: t('Cumulative Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const SPANS_TABLE_COLUMN_TYPE: Omit<
  Record<SuspectSpanTableColumnKeys, ColumnType>,
  'spans' | 'transactionDuration'
> = {
  id: 'string',
  timestamp: 'date',
  spanDuration: 'duration',
  occurrences: 'integer',
  cumulativeDuration: 'duration',
};

type Props = {
  location: Location;
  organization: Organization;
  suspectSpan: SuspectSpan;
  generateTransactionLink: (
    organization: Organization,
    tableData: TableDataRow,
    query: Query,
    hash?: string
  ) => LocationDescriptor;
  eventView: EventView;
  totals: SpansTotalValues | null;
};

export default function SuspectSpanEntry(props: Props) {
  const {
    location,
    organization,
    suspectSpan,
    generateTransactionLink,
    eventView,
    totals,
  } = props;

  const examples = suspectSpan.examples.map(example => ({
    id: example.id,
    project: suspectSpan.project,
    // timestamps are in seconds but want them in milliseconds
    timestamp: example.finishTimestamp * 1000,
    transactionDuration: (example.finishTimestamp - example.startTimestamp) * 1000,
    spanDuration: example.nonOverlappingExclusiveTime,
    occurrences: example.spans.length,
    cumulativeDuration: example.spans.reduce(
      (duration, span) => duration + span.exclusiveTime,
      0
    ),
    spans: example.spans,
  }));

  const sort = getSuspectSpanSortFromEventView(eventView);

  return (
    <div data-test-id="suspect-card">
      <UpperPanel data-test-id="suspect-card-upper">
        <HeaderItem
          label={t('Span Operation')}
          value={<SpanLabel span={suspectSpan} />}
          align="left"
        />
        <PercentileDuration sort={sort} suspectSpan={suspectSpan} totals={totals} />
        <SpanCount sort={sort} suspectSpan={suspectSpan} totals={totals} />
        <TotalCumulativeDuration sort={sort} suspectSpan={suspectSpan} totals={totals} />
      </UpperPanel>
      <LowerPanel data-test-id="suspect-card-lower">
        <GridEditable
          data={examples}
          columnOrder={SPANS_TABLE_COLUMN_ORDER}
          columnSortBy={[]}
          grid={{
            renderHeadCell,
            renderBodyCell: renderBodyCellWithMeta(
              location,
              organization,
              generateTransactionLink,
              suspectSpan
            ),
          }}
          location={location}
        />
      </LowerPanel>
    </div>
  );
}

type HeaderItemProps = {
  sort: SpanSortOption;
  suspectSpan: SuspectSpan;
  totals: SpansTotalValues | null;
};

const PERCENTILE_LABELS: Record<SpanSortPercentiles, string> = {
  [SpanSortPercentiles.P50_EXCLUSIVE_TIME]: t('p50 Duration'),
  [SpanSortPercentiles.P75_EXCLUSIVE_TIME]: t('p75 Duration'),
  [SpanSortPercentiles.P95_EXCLUSIVE_TIME]: t('p95 Duration'),
  [SpanSortPercentiles.P99_EXCLUSIVE_TIME]: t('p99 Duration'),
};

function PercentileDuration(props: HeaderItemProps) {
  const {sort, suspectSpan} = props;

  const sortKey = PERCENTILE_LABELS.hasOwnProperty(sort.field)
    ? sort.field
    : SpanSortPercentiles.P75_EXCLUSIVE_TIME;

  return (
    <HeaderItem
      label={PERCENTILE_LABELS[sortKey]}
      value={<PerformanceDuration abbreviation milliseconds={suspectSpan[sortKey]} />}
      align="right"
      isSortKey={sort.field === sortKey}
    />
  );
}

function SpanCount(props: HeaderItemProps) {
  const {sort, suspectSpan, totals} = props;

  if (sort.field === SpanSortOthers.COUNT) {
    return (
      <HeaderItem
        label={t('Occurrences')}
        value={String(suspectSpan.count)}
        align="right"
        isSortKey
      />
    );
  }

  if (sort.field === SpanSortOthers.AVG_OCCURRENCE) {
    return (
      <HeaderItem
        label={t('Avg Occurrences')}
        value={formatFloat(suspectSpan.avgOccurrences, 2)}
        align="right"
        isSortKey
      />
    );
  }

  // Because the frequency is computed using `count_unique(id)` internally,
  // it is an approximate value. This means that it has the potential to be
  // greater than `totals.count` when it shouldn't. So let's clip the
  // frequency value to make sure we don't see values over 100%.
  const frequency = defined(totals?.count)
    ? Math.min(suspectSpan.frequency, totals!.count)
    : suspectSpan.frequency;

  const value = defined(totals?.count) ? (
    <Tooltip
      title={tct('[frequency] out of [total] transactions contain this span', {
        frequency,
        total: totals!.count,
      })}
    >
      <span>{formatPercentage(frequency / totals!.count)}</span>
    </Tooltip>
  ) : (
    String(suspectSpan.count)
  );

  return <HeaderItem label={t('Frequency')} value={value} align="right" />;
}

function TotalCumulativeDuration(props: HeaderItemProps) {
  const {sort, suspectSpan, totals} = props;

  let value = (
    <PerformanceDuration abbreviation milliseconds={suspectSpan.sumExclusiveTime} />
  );

  if (defined(totals?.sum_transaction_duration)) {
    value = (
      <Tooltip
        title={tct('[percentage] of the total transaction duration of [duration]', {
          percentage: formatPercentage(
            suspectSpan.sumExclusiveTime / totals!.sum_transaction_duration
          ),
          duration: (
            <PerformanceDuration
              abbreviation
              milliseconds={totals!.sum_transaction_duration}
            />
          ),
        })}
      >
        {value}
      </Tooltip>
    );
  }

  return (
    <HeaderItem
      label={t('Total Cumulative Duration')}
      value={value}
      align="right"
      isSortKey={sort.field === SpanSortOthers.SUM_EXCLUSIVE_TIME}
    />
  );
}

function renderHeadCell(column: SuspectSpanTableColumn, _index: number): ReactNode {
  const align = fieldAlignment(column.key, SPANS_TABLE_COLUMN_TYPE[column.key]);
  return (
    <SortLink
      title={column.name}
      align={align}
      direction={undefined}
      canSort={false}
      generateSortLink={() => undefined}
    />
  );
}

function renderBodyCellWithMeta(
  location: Location,
  organization: Organization,
  generateTransactionLink: (
    organization: Organization,
    tableData: TableDataRow,
    query: Query,
    hash?: string
  ) => LocationDescriptor,
  suspectSpan: SuspectSpan
) {
  return (column: SuspectSpanTableColumn, dataRow: SuspectSpanDataRow): ReactNode => {
    // if the transaction duration is falsey, then just render the span duration on its own
    if (column.key === 'spanDuration' && dataRow.transactionDuration) {
      return (
        <SpanDurationBar
          spanOp={suspectSpan.op}
          spanDuration={dataRow.spanDuration}
          transactionDuration={dataRow.transactionDuration}
        />
      );
    }

    const fieldRenderer = getFieldRenderer(column.key, SPANS_TABLE_COLUMN_TYPE);
    let rendered = fieldRenderer(dataRow, {location, organization});

    if (column.key === 'id') {
      const worstSpan = dataRow.spans.length
        ? dataRow.spans.reduce((worst, span) =>
            worst.exclusiveTime >= span.exclusiveTime ? worst : span
          )
        : null;
      const target = generateTransactionLink(
        organization,
        dataRow,
        location.query,
        worstSpan.id
      );

      rendered = <Link to={target}>{rendered}</Link>;
    }

    return rendered;
  };
}

type SpanLabelProps = {
  span: SuspectSpan;
};

function SpanLabel(props: SpanLabelProps) {
  const {span} = props;

  const example = span.examples.find(ex => defined(ex.description));

  return (
    <Tooltip title={`${span.op} - ${example?.description ?? t('n/a')}`}>
      <SpanLabelContainer>
        <span>{span.op}</span> - {example?.description ?? emptyValue}
      </SpanLabelContainer>
    </Tooltip>
  );
}
