import {CSSProperties, Fragment} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
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
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DurationComparisonCell} from 'sentry/views/starfish/components/samplesTable/common';
import useErrorSamples from 'sentry/views/starfish/components/samplesTable/useErrorSamples';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {
  OverflowEllipsisTextContainer,
  TextAlignLeft,
  TextAlignRight,
} from 'sentry/views/starfish/components/textAlign';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {SampleFilter} from 'sentry/views/starfish/views/webServiceView/endpointOverview';

type Keys =
  | 'id'
  | 'profile_id'
  | 'timestamp'
  | 'transaction.duration'
  | 'avg_comparison'
  | 'span_ops_breakdown.relative'
  | 'http.status_code'
  | 'transaction.status';
type TableColumnHeader = GridColumnHeader<Keys>;

type Props = {
  data: DataRow[];
  isLoading: boolean;
  queryConditions: string[];
  sampleFilter: SampleFilter;
  setHighlightedId: (string) => void;
  averageDuration?: number;
  highlightedId?: string;
};

export type DataRow = {
  'http.status_code': number;
  id: string;
  profile_id: string;
  'spans.browser': number;
  'spans.db': number;
  'spans.http': number;
  'spans.resource': number;
  'spans.ui': number;
  timestamp: string;
  'transaction.duration': number;
  'transaction.status': string;
};

export function TransactionSamplesTable({
  queryConditions,
  sampleFilter,
  data,
  isLoading,
  averageDuration,
  setHighlightedId,
  highlightedId,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const query = new MutableSearch(queryConditions);

  const savedQuery: NewQuery = {
    id: undefined,
    name: 'Endpoint Overview Samples',
    query: query.formatString(),
    fields: [],
    dataset: DiscoverDatasets.DISCOVER,
    version: 2,
  };

  const columnOrder: TableColumnHeader[] = [
    {
      key: 'id',
      name: 'Event ID',
      width: 100,
    },
    ...(sampleFilter === 'ALL'
      ? [
          {
            key: 'profile_id',
            name: 'Profile ID',
            width: 140,
          } as TableColumnHeader,
          {
            key: SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
            name: 'Operation Duration',
            width: 180,
          } as TableColumnHeader,
          {
            key: 'timestamp',
            name: 'Timestamp',
            width: 230,
          } as TableColumnHeader,
          {
            key: 'transaction.duration',
            name: DataTitles.duration,
            width: 100,
          } as TableColumnHeader,
          {
            key: 'avg_comparison',
            name: 'Compared to Average',
            width: 100,
          } as TableColumnHeader,
        ]
      : [
          {
            key: 'http.status_code',
            name: 'Response Code',
            width: COL_WIDTH_UNDEFINED,
          } as TableColumnHeader,
          {
            key: 'transaction.status',
            name: 'Status',
            width: COL_WIDTH_UNDEFINED,
          } as TableColumnHeader,
          {
            key: 'timestamp',
            name: 'Timestamp',
            width: 230,
          } as TableColumnHeader,
        ]),
  ];

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  const {isLoading: isErrorSamplesLoading, data: errorSamples} =
    useErrorSamples(eventView);

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (column.key === 'avg_comparison' || column.key === 'transaction.duration') {
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
    const commonProps = {
      style: (row.id === highlightedId
        ? {fontWeight: 'bold'}
        : {}) satisfies CSSProperties,
      onMouseEnter: () => setHighlightedId(row.id),
    };

    if (column.key === 'id') {
      return (
        <Link
          {...commonProps}
          to={normalizeUrl(
            `/organizations/${organization.slug}/performance/${row['project.name']}:${row.id}`
          )}
        >
          {row.id.slice(0, 8)}
        </Link>
      );
    }

    if (column.key === 'profile_id') {
      return row.profile_id ? (
        <Link
          {...commonProps}
          to={normalizeUrl(
            `/organizations/${organization.slug}/profiling/profile/${row['project.name']}/${row.profile_id}/flamechart/`
          )}
        >
          {row.profile_id.slice(0, 8)}
        </Link>
      ) : (
        <div {...commonProps}>(no value)</div>
      );
    }

    if (column.key === 'transaction.duration') {
      return <DurationCell milliseconds={row['transaction.duration']} />;
    }

    if (column.key === 'timestamp') {
      return <DateTime {...commonProps} date={row[column.key]} year timeZone seconds />;
    }

    if (column.key === 'avg_comparison') {
      return (
        <DurationComparisonContainer {...commonProps}>
          <DurationComparisonCell
            duration={row['transaction.duration']}
            compareToDuration={averageDuration ?? 0}
          />
        </DurationComparisonContainer>
      );
    }

    if (column.key === SPAN_OP_RELATIVE_BREAKDOWN_FIELD) {
      return getFieldRenderer(column.key, {})(row, {
        location,
        organization,
        eventView,
      });
    }

    return <TextAlignLeft {...commonProps}>{row[column.key]}</TextAlignLeft>;
  }

  return (
    <div onMouseLeave={() => setHighlightedId(undefined)}>
      <GridEditable
        isLoading={sampleFilter === 'ALL' ? isLoading : isErrorSamplesLoading}
        data={sampleFilter === 'ALL' ? (data as DataRow[]) : (errorSamples as DataRow[])}
        columnOrder={columnOrder}
        columnSortBy={[]}
        location={location}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </div>
  );
}

const DurationComparisonContainer = styled('div')`
  text-align: right;
  width: 100%;
  display: inline-block;
`;

const StyledIconQuestion = styled(QuestionTooltip)`
  position: relative;
  left: 4px;
`;
