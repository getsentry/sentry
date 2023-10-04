import {Fragment} from 'react';
import {Link} from 'react-router';
import * as qs from 'query-string';

import FileSize from 'sentry/components/fileSize';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {BrowserStarfishFields} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {ValidSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';

type Row = {
  'avg(span.duration)': number;
  description: string;
  domain: string;
  'http.decoded_response_content_length': number;
  'http.response_content_length': number;
  'resource.render_blocking_status': string;
  'span.group': string;
  type: string;
};

type Column = GridColumnHeader<keyof Row>;

type Props = {
  sort: ValidSort;
};

function ResourceTable({sort}: Props) {
  const location = useLocation();
  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: 'description', width: COL_WIDTH_UNDEFINED, name: 'Resource name'},
    {key: 'avg(span.duration)', width: COL_WIDTH_UNDEFINED, name: 'Avg Duration'},
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
  const tableData: Row[] = [
    {
      'avg(span.duration)': 20,
      description:
        'app_components_events_interfaces_spans_constants_tsx-app_components_gridEditable_styles_tsx-a-1f90d6.***.js',
      domain: 's1.sentry-cdn.com',
      'http.decoded_response_content_length': 300,
      'http.response_content_length': 300,
      'resource.render_blocking_status': 'non-blocking',
      type: '.js',
      'span.group': 'group123',
    },
    {
      'avg(span.duration)': 25,
      description: 'app_bootstrap_initializeMain_tsx.***.js',
      domain: 's1.sentry-cdn.com',
      'http.decoded_response_content_length': 150,
      'http.response_content_length': 200,
      'resource.render_blocking_status': 'blocking',
      type: '.js',
      'span.group': 'group456',
    },
  ];

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    if (key === 'description') {
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
    if (key === 'http.response_content_length') {
      return <FileSize bytes={row[key]} />;
    }
    if (key === 'avg(span.duration)') {
      return <DurationCell milliseconds={row[key]} />;
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
        isLoading={false}
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
