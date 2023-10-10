import {Fragment} from 'react';
import {Link} from 'react-router';
import * as qs from 'query-string';

import FileSize from 'sentry/components/fileSize';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {RateUnits} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {BrowserStarfishFields} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {ValidSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';
import {useResourcesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcesQuery';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';

type Row = {
  'avg(span.self_time)': number;
  domain: string;
  'http.decoded_response_content_length': number;
  'http.response_content_length': number;
  'resource.render_blocking_status': string;
  'span.description': string;
  'span.group': string;
  'span.op': 'resource.script' | 'resource.img';
  'spm()': number;
};

type Column = GridColumnHeader<keyof Row>;

type Props = {
  sort: ValidSort;
};

function ResourceTable({sort}: Props) {
  const location = useLocation();
  const {data, isLoading, pageLinks} = useResourcesQuery({sort});

  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: 'span.description', width: COL_WIDTH_UNDEFINED, name: 'Resource name'},
    {key: 'span.op', width: COL_WIDTH_UNDEFINED, name: 'Type'},
    {key: 'avg(span.self_time)', width: COL_WIDTH_UNDEFINED, name: 'Avg Duration'},
    {
      key: 'spm()',
      width: COL_WIDTH_UNDEFINED,
      name: 'Throughput',
    },
    {
      key: 'http.response_content_length',
      width: COL_WIDTH_UNDEFINED,
      name: 'Resource size',
    },
    {
      key: 'resource.render_blocking_status',
      width: COL_WIDTH_UNDEFINED,
      name: 'Render blocking',
    },
    {
      key: 'http.decoded_response_content_length',
      width: COL_WIDTH_UNDEFINED,
      name: 'Uncompressed',
    },
  ];
  const tableData: Row[] = data.length
    ? data.map(span => ({
        ...span,
        'http.decoded_response_content_length': Math.floor(
          Math.random() * (1000 - 500) + 500
        ),
        'http.response_content_length': Math.floor(Math.random() * (500 - 50) + 50),
        'resource.render_blocking_status':
          Math.random() > 0.5 ? 'blocking' : 'non-blocking',
        'span.group': 'group123',
        domain: 's1.sentry-cdn.com',
      }))
    : [];

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    if (key === 'span.description') {
      const query = {
        ...location.query,
        [BrowserStarfishFields.DESCRIPTION]: row[key],
      };
      return (
        <Link to={`/performance/browser/resources/?${qs.stringify(query)}`}>
          {row[key]}
        </Link>
      );
    }
    if (key === 'spm()') {
      return <ThroughputCell rate={row[key]} unit={RateUnits.PER_SECOND} />;
    }
    if (key === 'http.response_content_length') {
      return <FileSize bytes={row[key]} />;
    }
    if (key === 'avg(span.self_time)') {
      return <DurationCell milliseconds={row[key]} />;
    }
    if (key === 'span.op') {
      const opName = row[key] === 'resource.script' ? t('Javascript') : t('Image');
      return <span>{opName}</span>;
    }
    if (key === 'http.decoded_response_content_length') {
      const isCompressed =
        row['http.response_content_length'] !==
        row['http.decoded_response_content_length'];
      return <span>{isCompressed ? t('true') : t('false')}</span>;
    }
    return <span>{row[key]}</span>;
  };

  return (
    <Fragment>
      <GridEditable
        data={tableData}
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

export default ResourceTable;
