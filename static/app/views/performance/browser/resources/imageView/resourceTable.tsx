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
import {ValidSort} from 'sentry/views/performance/browser/resources/imageView/utils/useImageResourceSort';
import {useIndexedResourcesQuery} from 'sentry/views/performance/browser/resources/imageView/utils/useIndexedResourcesQuery';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanMetricsField} from 'sentry/views/starfish/types';

const {SPAN_DESCRIPTION, SPAN_SELF_TIME, HTTP_RESPONSE_CONTENT_LENGTH} = SpanMetricsField;

type Row = {
  'http.response_content_length': number;
  id: string;
  project: string;
  'resource.render_blocking_status': '' | 'non-blocking' | 'blocking';
  'span.description': string;
  'span.self_time': number;
};

type Column = GridColumnHeader<keyof Row>;

type Props = {
  sort: ValidSort;
};

function ResourceTable({sort}: Props) {
  const location = useLocation();
  const {data, isLoading, pageLinks} = useIndexedResourcesQuery();

  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: SPAN_DESCRIPTION, width: COL_WIDTH_UNDEFINED, name: 'Resource name'},
    {key: `${SPAN_SELF_TIME}`, width: COL_WIDTH_UNDEFINED, name: 'Duration'},
    {
      key: HTTP_RESPONSE_CONTENT_LENGTH,
      width: COL_WIDTH_UNDEFINED,
      name: t('Resource size'),
    },
  ];
  const tableData: Row[] = data.length
    ? data.map(span => ({
        ...span,
        'http.decoded_response_content_length': Math.floor(
          Math.random() * (1000 - 500) + 500
        ),
      }))
    : [];

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    if (key === SPAN_DESCRIPTION) {
      return (
        <Link to={`/performance/${row.project}:${row['transaction.id']}#span-${row.id}`}>
          {row[key]}
        </Link>
      );
    }
    if (key === 'http.response_content_length') {
      return <FileSize bytes={row[key]} />;
    }
    if (key === `span.self_time`) {
      return <DurationCell milliseconds={row[key]} />;
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

export default ResourceTable;
