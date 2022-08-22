import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor, toPercent} from 'sentry/components/performance/waterfall/utils';
import PerformanceDuration from 'sentry/components/performanceDuration';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {ColumnType, fieldAlignment} from 'sentry/utils/discover/fields';
import {formatPercentage} from 'sentry/utils/formatters';
import {
  ExampleTransaction,
  SuspectSpan,
} from 'sentry/utils/performance/suspectSpans/types';

import {generateTransactionLink} from '../../utils';

type TableColumnKeys =
  | 'id'
  | 'timestamp'
  | 'transactionDuration'
  | 'spanDuration'
  | 'occurrences'
  | 'cumulativeDuration'
  | 'spans';

type TableColumn = GridColumnOrder<TableColumnKeys>;

type TableDataRow = Record<TableColumnKeys, any>;

type Props = {
  examples: ExampleTransaction[];
  isLoading: boolean;
  location: Location;
  organization: Organization;
  transactionName: string;
  pageLinks?: string | null;
  project?: Project;
  suspectSpan?: SuspectSpan;
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

  const data = examples
    // we assume that the span appears in each example at least once,
    // if this assumption is broken, nothing onwards will work so
    // filter out such examples
    .filter(example => example.spans.length > 0)
    .map(example => ({
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

function renderHeadCell(column: TableColumn, _index: number): React.ReactNode {
  const align = fieldAlignment(column.key, COLUMN_TYPE[column.key]);
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
  suspectSpan?: SuspectSpan
) {
  return (column: TableColumn, dataRow: TableDataRow): React.ReactNode => {
    // if the transaction duration is falsey, then just render the span duration on its own
    if (column.key === 'spanDuration' && dataRow.transactionDuration) {
      return (
        <SpanDurationBar
          spanOp={suspectSpan?.op ?? ''}
          spanDuration={dataRow.spanDuration}
          transactionDuration={dataRow.transactionDuration}
        />
      );
    }

    const fieldRenderer = getFieldRenderer(column.key, COLUMN_TYPE);
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

const COLUMN_TYPE: Omit<
  Record<TableColumnKeys, ColumnType>,
  'spans' | 'transactionDuration'
> = {
  id: 'string',
  timestamp: 'date',
  spanDuration: 'duration',
  occurrences: 'integer',
  cumulativeDuration: 'duration',
};

const SPANS_TABLE_COLUMN_ORDER: TableColumn[] = [
  {
    key: 'id',
    name: t('Event ID'),
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

const DurationBar = styled('div')`
  position: relative;
  display: flex;
  top: ${space(0.5)};
  background-color: ${p => p.theme.gray100};
`;

const DurationBarSection = styled(RowRectangle)`
  position: relative;
  width: 100%;
  top: 0;
`;

type SpanDurationBarProps = {
  spanDuration: number;
  spanOp: string;
  transactionDuration: number;
};

function SpanDurationBar(props: SpanDurationBarProps) {
  const {spanOp, spanDuration, transactionDuration} = props;
  const widthPercentage = spanDuration / transactionDuration;
  const position = widthPercentage < 0.7 ? 'right' : 'inset';

  return (
    <DurationBar>
      <div style={{width: toPercent(widthPercentage)}}>
        <Tooltip
          title={tct('[percentage] of the transaction', {
            percentage: formatPercentage(widthPercentage),
          })}
          containerDisplayMode="block"
        >
          <DurationBarSection
            spanBarHatch={false}
            style={{backgroundColor: pickBarColor(spanOp)}}
          >
            <DurationPill
              durationDisplay={position}
              showDetail={false}
              spanBarHatch={false}
            >
              <PerformanceDuration abbreviation milliseconds={spanDuration} />
            </DurationPill>
          </DurationBarSection>
        </Tooltip>
      </div>
    </DurationBar>
  );
}
