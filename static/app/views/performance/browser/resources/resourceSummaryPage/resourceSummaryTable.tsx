import {Fragment} from 'react';
import {browserHistory, Link} from 'react-router';
import styled from '@emotion/styled';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/performance/browser/resources';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {useResourcePagesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcePageQuery';
import {useResourceSummarySort} from 'sentry/views/performance/browser/resources/utils/useResourceSummarySort';
import {FullSpanDescription} from 'sentry/views/starfish/components/fullSpanDescription';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import ResourceSizeCell from 'sentry/views/starfish/components/tableCells/resourceSizeCell';
import {WiderHovercard} from 'sentry/views/starfish/components/tableCells/spanDescriptionCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {SpanIndexedField, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

const {
  RESOURCE_RENDER_BLOCKING_STATUS,
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
  TRANSACTION,
} = SpanMetricsField;

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
  const filters = useResourceModuleFilters();
  const cursor = decodeScalar(location.query?.[QueryParameterNames.PAGES_CURSOR]);
  const {data, isLoading, pageLinks} = useResourcePagesQuery(groupId, {
    sort,
    cursor,
    renderBlockingStatus: filters[RESOURCE_RENDER_BLOCKING_STATUS],
  });

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
      return <ResourceSizeCell bytes={row[key]} />;
    }
    if (key === 'transaction') {
      const blockingStatus = row['resource.render_blocking_status'];
      let query = `!has:${RESOURCE_RENDER_BLOCKING_STATUS}`;
      if (blockingStatus) {
        query = `${RESOURCE_RENDER_BLOCKING_STATUS}:${blockingStatus}`;
      }

      const link = (
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

      return (
        <DescriptionWrapper>
          <WiderHovercard
            position="right"
            body={
              <Fragment>
                <TitleWrapper>{t('Example')}</TitleWrapper>
                <FullSpanDescription
                  group={groupId}
                  language="http"
                  filters={{
                    [SpanIndexedField.RESOURCE_RENDER_BLOCKING_STATUS]:
                      row[RESOURCE_RENDER_BLOCKING_STATUS],
                    [SpanIndexedField.TRANSACTION]: row[TRANSACTION],
                  }}
                />
              </Fragment>
            }
          >
            {link}
          </WiderHovercard>
        </DescriptionWrapper>
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

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.PAGES_CURSOR]: newCursor},
    });
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
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
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

const TitleWrapper = styled('div')`
  margin-bottom: ${space(1)};
`;

const DescriptionWrapper = styled('div')`
  .inline-flex {
    display: inline-flex;
  }
`;

export default ResourceSummaryTable;
