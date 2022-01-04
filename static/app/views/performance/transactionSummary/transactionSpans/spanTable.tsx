import {Fragment} from 'react';
import {Location} from 'history';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {ColumnType, fieldAlignment} from 'sentry/utils/discover/fields';
import {
  ExampleTransaction,
  SuspectSpan,
} from 'sentry/utils/performance/suspectSpans/types';

import {generateTransactionLink} from '../utils';

import {SpanDurationBar} from './styles';
import {
  SuspectSpanDataRow,
  SuspectSpanTableColumn,
  SuspectSpanTableColumnKeys,
} from './types';

type Props = {
  location: Location;
  organization: Organization;
  suspectSpan: SuspectSpan;
  transactionName: string;
  isLoading: boolean;
  examples: ExampleTransaction[];
  project?: Project;
  pageLinks?: string | null;
};

export default function SpanTable(props: Props) {
  const {
    location,
    organization,
    project,
    examples,
    suspectSpan,
    transactionName,
    isLoading,
    pageLinks,
  } = props;

  if (!defined(examples)) {
    return null;
  }

  const data = examples.map(example => ({
    id: example.id,
    project: project?.slug,
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

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={data}
        columnOrder={SPANS_TABLE_COLUMN_ORDER}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell: renderBodyCellWithMeta(
            location,
            organization,
            transactionName,
            suspectSpan
          ),
        }}
        location={location}
      />
      <Pagination pageLinks={pageLinks ?? null} />
    </Fragment>
  );
}

function renderHeadCell(column: SuspectSpanTableColumn, _index: number): React.ReactNode {
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
  transactionName: string,
  suspectSpan: SuspectSpan
) {
  return (
    column: SuspectSpanTableColumn,
    dataRow: SuspectSpanDataRow
  ): React.ReactNode => {
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
      const target = generateTransactionLink(transactionName)(
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
    name: t('Count'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'cumulativeDuration',
    name: t('Cumulative Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
];
