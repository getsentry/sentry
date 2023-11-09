import {Fragment} from 'react';
import {Link} from 'react-router';

import FileSize from 'sentry/components/fileSize';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/performance/browser/resources';
import {useResourcePagesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcePageQuery';
import {useResourceSummarySort} from 'sentry/views/performance/browser/resources/utils/useResourceSummarySort';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

const {RESOURCE_RENDER_BLOCKING_STATUS, SPAN_SELF_TIME, HTTP_RESPONSE_CONTENT_LENGTH} =
  SpanMetricsField;

type Row = {
  'avg(http.response_content_length)': number;
  'avg(span.self_time)': number;
  'resource.render_blocking_status': '' | 'non-blocking' | 'blocking';
  'spm()': number;
  transaction: string;
};

type Column = GridColumnHeader<keyof Row>;

function ResourceSummaryTable() {
  const location = useLocation();
  const {groupId} = useParams();
  const sort = useResourceSummarySort();
  const {data, isLoading, pageLinks} = useResourcePagesQuery(groupId, {sort});

  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Found on page'},
    {
      key: 'spm()',
      width: COL_WIDTH_UNDEFINED,
      name: getThroughputTitle('http'),
    },
    {
      key: `avg(${SPAN_SELF_TIME})`,
      width: COL_WIDTH_UNDEFINED,
      name: t('Avg Duration'),
    },
    {
      key: `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
      width: COL_WIDTH_UNDEFINED,
      name: DataTitles[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`],
    },
    {
      key: RESOURCE_RENDER_BLOCKING_STATUS,
      width: COL_WIDTH_UNDEFINED,
      name: t('Render Blocking'),
    },
  ];

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    if (key === 'spm()') {
      return <ThroughputCell rate={row[key]} unit={RESOURCE_THROUGHPUT_UNIT} />;
    }
    if (key === 'avg(span.self_time)') {
      return <DurationCell milliseconds={row[key]} />;
    }
    if (key === 'avg(http.response_content_length)') {
      return <FileSize bytes={row[key]} />;
    }
    if (key === 'transaction') {
      const blockingStatus = row['resource.render_blocking_status'];
      let query = `!has:${RESOURCE_RENDER_BLOCKING_STATUS}`;
      if (blockingStatus) {
        query = `${RESOURCE_RENDER_BLOCKING_STATUS}:${blockingStatus}`;
      }

      return (
        <Link
          to={{
            pathname: location.pathname,
            query: {
              ...location.query,
              transaction: row[key],
              query: [query],
            },
          }}
        >
          {row[key]}
        </Link>
      );
    }
    if (key === RESOURCE_RENDER_BLOCKING_STATUS) {
      const value = row[key];
      if (value === 'blocking') {
        return <span>{t('Yes')}</span>;
      }
      if (value === 'non-blocking') {
        return <span>{t('No')}</span>;
      }
      return <span>{'-'}</span>;
    }
    return <span>{row[key]}</span>;
  };

  return (
    <Fragment>
      <GridEditable
        data={data || []}
        isLoading={isLoading}
        columnOrder={columnOrder}
        columnSortBy={[
          {
            key: sort.field,
            order: sort.kind,
          },
        ]}
        grid={{
          renderHeadCell: column =>
            renderHeadCell({
              column,
              location,
              sort,
            }),
          renderBodyCell,
        }}
        location={location}
      />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

export const getActionName = (transactionOp: string) => {
  switch (transactionOp) {
    case 'ui.action.click':
      return 'Click';
    default:
      return transactionOp;
  }
};

export default ResourceSummaryTable;
