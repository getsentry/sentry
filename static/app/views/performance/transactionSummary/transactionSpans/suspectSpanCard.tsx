import {ReactNode} from 'react';
import {Location, LocationDescriptor, Query} from 'history';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {defined} from 'app/utils';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {ColumnType, fieldAlignment} from 'app/utils/discover/fields';
import {SuspectSpan} from 'app/utils/performance/suspectSpans/types';

import {PerformanceDuration} from '../../utils';

import {
  emptyValue,
  HeaderItem,
  LowerPanel,
  SpanLabelContainer,
  UpperPanel,
} from './styles';
import {
  SpanSortOption,
  SpanSortPercentiles,
  SuspectSpanDataRow,
  SuspectSpanTableColumn,
  SuspectSpanTableColumnKeys,
} from './types';
import {getSuspectSpanSortFromEventView} from './utils';

const SPANS_TABLE_COLUMN_ORDER: SuspectSpanTableColumn[] = [
  {
    key: 'id',
    name: 'Event ID',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'timestamp',
    name: 'Timestamp',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spanDuration',
    name: 'Span Duration',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'repeated',
    name: 'Repeated',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'cumulativeDuration',
    name: 'Cumulative Duration',
    width: COL_WIDTH_UNDEFINED,
  },
];

const SPANS_TABLE_COLUMN_TYPE: Partial<Record<SuspectSpanTableColumnKeys, ColumnType>> = {
  id: 'string',
  timestamp: 'date',
  spanDuration: 'duration',
  repeated: 'integer',
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
};

export default function SuspectSpanEntry(props: Props) {
  const {location, organization, suspectSpan, generateTransactionLink, eventView} = props;

  const examples = suspectSpan.examples.map(example => ({
    id: example.id,
    project: suspectSpan.project,
    // finish timestamp is in seconds but want milliseconds
    timestamp: example.finishTimestamp * 1000,
    spanDuration: example.nonOverlappingExclusiveTime,
    repeated: example.spans.length,
    cumulativeDuration: example.spans.reduce(
      (duration, span) => duration + span.exclusiveTime,
      0
    ),
    spans: example.spans,
  }));

  return (
    <div data-test-id="suspect-card">
      <UpperPanel>
        <HeaderItem
          label="Span Operation"
          value={<SpanLabel span={suspectSpan} />}
          align="left"
        />
        <PercentileDuration
          sort={getSuspectSpanSortFromEventView(eventView)}
          suspectSpan={suspectSpan}
        />
        <HeaderItem
          label="Frequency"
          value={String(suspectSpan.frequency)}
          align="right"
        />
        <HeaderItem
          label="Total Cumulative Duration"
          value={
            <PerformanceDuration
              abbreviation
              milliseconds={suspectSpan.sumExclusiveTime}
            />
          }
          align="right"
        />
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
              generateTransactionLink
            ),
          }}
          location={location}
        />
      </LowerPanel>
    </div>
  );
}

const PERCENTILE_LABELS: Record<SpanSortPercentiles, string> = {
  [SpanSortPercentiles.P50_EXCLUSIVE_TIME]: t('p50 Duration'),
  [SpanSortPercentiles.P75_EXCLUSIVE_TIME]: t('p75 Duration'),
  [SpanSortPercentiles.P95_EXCLUSIVE_TIME]: t('p95 Duration'),
  [SpanSortPercentiles.P99_EXCLUSIVE_TIME]: t('p99 Duration'),
};

type PercentileDurationProps = {
  sort: SpanSortOption;
  suspectSpan: SuspectSpan;
};

function PercentileDuration(props: PercentileDurationProps) {
  const {sort, suspectSpan} = props;

  return (
    <HeaderItem
      label={
        PERCENTILE_LABELS[sort.field] ??
        PERCENTILE_LABELS[SpanSortPercentiles.P75_EXCLUSIVE_TIME]
      }
      value={
        <PerformanceDuration
          abbreviation
          milliseconds={
            suspectSpan[sort.field] ?? suspectSpan[SpanSortPercentiles.P75_EXCLUSIVE_TIME]
          }
        />
      }
      align="right"
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
  ) => LocationDescriptor
) {
  return (column: SuspectSpanTableColumn, dataRow: SuspectSpanDataRow): ReactNode => {
    const fieldRenderer = getFieldRenderer(column.key, SPANS_TABLE_COLUMN_TYPE);
    let rendered = fieldRenderer(dataRow, {location, organization});

    if (column.key === 'id') {
      const worstSpan = dataRow.spans.length
        ? dataRow.spans.reduce((worst, span) =>
            worst.exclusiveTime >= span.exclusiveTime ? worst : span
          )
        : null;
      const hash = worstSpan ? `#span-${worstSpan.id}` : undefined;
      const target = generateTransactionLink(organization, dataRow, location.query, hash);

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
