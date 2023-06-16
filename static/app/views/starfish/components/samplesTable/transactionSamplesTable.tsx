import {Fragment} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {SPAN_OP_RELATIVE_BREAKDOWN_FIELD} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {DurationComparisonCell} from 'sentry/views/starfish/components/samplesTable/common';
import useSlowMedianFastSamplesQuery from 'sentry/views/starfish/components/samplesTable/useSlowMedianFastSamplesQuery';
import {
  OverflowEllipsisTextContainer,
  TextAlignLeft,
  TextAlignRight,
} from 'sentry/views/starfish/components/textAlign';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Keys =
  | 'id'
  | 'profile_id'
  | 'timestamp'
  | 'transaction.duration'
  | 'p95_comparison'
  | 'span_ops_breakdown.relative';
type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'id',
    name: 'Event ID',
    width: 100,
  },
  {
    key: 'profile_id',
    name: 'Profile ID',
    width: 140,
  },
  {
    key: SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
    name: 'Operation Duration',
    width: 180,
  },
  {
    key: 'timestamp',
    name: 'Timestamp',
    width: 230,
  },
  {
    key: 'transaction.duration',
    name: DataTitles.duration,
    width: 100,
  },
  {
    key: 'p95_comparison',
    name: 'Compared to P95',
    width: 100,
  },
];

type Props = {
  queryConditions: string[];
};

type DataRow = {
  id: string;
  profile_id: string;
  'spans.browser': number;
  'spans.db': number;
  'spans.http': number;
  'spans.resource': number;
  'spans.ui': number;
  timestamp: string;
  'transaction.duration': number;
};

export function TransactionSamplesTable({queryConditions}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const query = new MutableSearch(queryConditions);

  const savedQuery: NewQuery = {
    id: undefined,
    name: 'Endpoint Overview Samples',
    query: query.formatString(),
    projects: [1],
    fields: [],
    dataset: DiscoverDatasets.DISCOVER,
    version: 2,
  };

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  const {isLoading, data, aggregatesData} = useSlowMedianFastSamplesQuery(eventView);

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (column.key === 'p95_comparison') {
      return (
        <TextAlignRight>
          <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
        </TextAlignRight>
      );
    }

    if (column.key === SPAN_OP_RELATIVE_BREAKDOWN_FIELD) {
      return (
        <Fragment>
          {column.name}
          <StyledIconQuestion
            size="xs"
            position="top"
            title={t(
              `Span durations are summed over the course of an entire transaction. Any overlapping spans are only counted once.`
            )}
          />
        </Fragment>
      );
    }

    return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
  }

  function renderBodyCell(column: TableColumnHeader, row: DataRow): React.ReactNode {
    if (column.key === 'id') {
      return (
        <Link to={`/performance/${row['project.name']}:${row.id}`}>
          {row.id.slice(0, 8)}
        </Link>
      );
    }

    if (column.key === 'profile_id') {
      return row.profile_id ? (
        <Link
          to={`/profiling/profile/${row['project.name']}/${row.profile_id}/flamechart/`}
        >
          {row.profile_id.slice(0, 8)}
        </Link>
      ) : (
        '(no value)'
      );
    }

    if (column.key === 'transaction.duration') {
      return (
        <Duration
          seconds={row['transaction.duration'] / 1000}
          fixedDigits={2}
          abbreviation
        />
      );
    }

    if (column.key === 'timestamp') {
      return <DateTime date={row[column.key]} year timeZone seconds />;
    }

    if (column.key === 'p95_comparison') {
      return (
        <DurationComparisonCell
          duration={row['transaction.duration']}
          p95={(aggregatesData?.['p95(transaction.duration)'] as number) ?? 0}
        />
      );
    }

    if (column.key === SPAN_OP_RELATIVE_BREAKDOWN_FIELD) {
      return getFieldRenderer(column.key, {})(row, {
        location,
        organization,
        eventView,
      });
    }

    return <TextAlignLeft>{row[column.key]}</TextAlignLeft>;
  }

  return (
    <GridEditable
      isLoading={isLoading}
      data={data as DataRow[]}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      location={location}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
    />
  );
}

const StyledIconQuestion = styled(QuestionTooltip)`
  position: relative;
  left: 4px;
`;
