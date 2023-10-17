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
import {RateUnits} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {ValidSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';
import {useResourcesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcesQuery';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';

const {
  SPAN_DESCRIPTION,
  RESOURCE_RENDER_BLOCKING_STATUS,
  SPAN_OP,
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
} = SpanMetricsField;

const {SPM} = SpanFunction;

type Row = {
  'avg(http.response_content_length)': number;
  'avg(span.self_time)': number;
  'http.decoded_response_content_length': number;
  'resource.render_blocking_status': string;
  'span.description': string;
  'span.domain': string;
  'span.group': string;
  'span.op': `resource.${'script' | 'img' | 'css' | 'iframe' | string}`;
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
    {key: SPAN_DESCRIPTION, width: COL_WIDTH_UNDEFINED, name: 'Resource name'},
    {key: SPAN_OP, width: COL_WIDTH_UNDEFINED, name: 'Type'},
    {key: `avg(${SPAN_SELF_TIME})`, width: COL_WIDTH_UNDEFINED, name: 'Avg Duration'},
    {
      key: `${SPM}()`,
      width: COL_WIDTH_UNDEFINED,
      name: t('Throughput'),
    },
    {
      key: `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
      width: COL_WIDTH_UNDEFINED,
      name: t('Avg Resource size'),
    },
    {
      key: RESOURCE_RENDER_BLOCKING_STATUS,
      width: COL_WIDTH_UNDEFINED,
      name: t('Render blocking'),
    },
    {
      key: 'http.decoded_response_content_length',
      width: COL_WIDTH_UNDEFINED,
      name: t('Uncompressed'),
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
        <Link to={`/performance/browser/resources/resource/${row['span.group']}`}>
          {row[key]}
        </Link>
      );
    }
    if (key === 'spm()') {
      return <ThroughputCell rate={row[key] * 60} unit={RateUnits.PER_SECOND} />;
    }
    if (key === 'avg(http.response_content_length)') {
      return <FileSize bytes={row[key]} />;
    }
    if (key === `avg(span.self_time)`) {
      return <DurationCell milliseconds={row[key]} />;
    }
    if (key === SPAN_OP) {
      const opNameMap = {
        'resource.script': t('Javascript'),
        'resource.img': t('Image'),
        'resource.iframe': t('Javascript (iframe)'),
        'resource.css': t('Stylesheet'),
        'resource.video': t('Video'),
        'resource.audio': t('Audio'),
      };
      const opName = opNameMap[row[key]] || row[key];
      return <span>{opName}</span>;
    }
    if (key === 'http.decoded_response_content_length') {
      const isUncompressed =
        row['http.response_content_length'] ===
        row['http.decoded_response_content_length'];
      return <span>{isUncompressed ? t('true') : t('false')}</span>;
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
