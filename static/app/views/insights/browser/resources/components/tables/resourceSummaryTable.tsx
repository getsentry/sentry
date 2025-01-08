import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {GridColumnHeader, GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useResourcePagesQuery} from 'sentry/views/insights/browser/resources/queries/useResourcePageQuery';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/insights/browser/resources/settings';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useResourceSummarySort} from 'sentry/views/insights/browser/resources/utils/useResourceSummarySort';
import {FullSpanDescription} from 'sentry/views/insights/common/components/fullSpanDescription';
import {DurationCell} from 'sentry/views/insights/common/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import ResourceSizeCell from 'sentry/views/insights/common/components/tableCells/resourceSizeCell';
import {WiderHovercard} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {ThroughputCell} from 'sentry/views/insights/common/components/tableCells/throughputCell';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {
  ModuleName,
  SpanIndexedField,
  SpanMetricsField,
} from 'sentry/views/insights/types';

const {
  RESOURCE_RENDER_BLOCKING_STATUS,
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
  TRANSACTION,
  USER_GEO_SUBREGION,
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
  const navigate = useNavigate();
  const location = useLocation();
  const {groupId} = useParams();
  const sort = useResourceSummarySort();
  const filters = useResourceModuleFilters();
  const cursor = decodeScalar(location.query?.[QueryParameterNames.PAGES_CURSOR]);
  const {data, isPending, pageLinks} = useResourcePagesQuery(groupId!, {
    sort,
    cursor,
    subregions: filters[USER_GEO_SUBREGION],
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
                  moduleName={ModuleName.RESOURCE}
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
    navigate({
      pathname,
      query: {...query, [QueryParameterNames.PAGES_CURSOR]: newCursor},
    });
  };

  return (
    <Fragment>
      <GridEditable
        data={data || []}
        isLoading={isPending}
        columnOrder={columnOrder}
        columnSortBy={[
          {
            key: sort.field as keyof Row,
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
