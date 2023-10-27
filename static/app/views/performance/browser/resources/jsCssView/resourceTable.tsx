import {Fragment} from 'react';

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
import {SpanDescriptionCell} from 'sentry/views/starfish/components/tableCells/spanDescriptionCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {ModuleName, SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';

const {
  SPAN_DESCRIPTION,
  SPAN_OP,
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
  PROJECT_ID,
  SPAN_GROUP,
} = SpanMetricsField;

const {SPM} = SpanFunction;

type Row = {
  'avg(http.response_content_length)': number;
  'avg(span.self_time)': number;
  'http.decoded_response_content_length': number;
  'project.id': number;
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
  const {data, isLoading, pageLinks} = useResourcesQuery({
    sort,
    defaultResourceTypes: ['resource.script', 'resource.css'],
  });

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
        <SpanDescriptionCell
          moduleName={ModuleName.HTTP}
          projectId={row[PROJECT_ID]}
          description={row[SPAN_DESCRIPTION]}
          group={row[SPAN_GROUP]}
        />
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

export default ResourceTable;
