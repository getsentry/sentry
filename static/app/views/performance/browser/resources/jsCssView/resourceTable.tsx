import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

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
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/performance/browser/resources';
import {ValidSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';
import {useResourcesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcesQuery';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import ResourceSizeCell from 'sentry/views/starfish/components/tableCells/resourceSizeCell';
import {SpanDescriptionCell} from 'sentry/views/starfish/components/tableCells/spanDescriptionCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {ModuleName, SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

const {
  SPAN_DESCRIPTION,
  SPAN_OP,
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
  PROJECT_ID,
  SPAN_GROUP,
  FILE_EXTENSION,
} = SpanMetricsField;

const {TIME_SPENT_PERCENTAGE} = SpanFunction;

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
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
};

type Column = GridColumnHeader<keyof Row>;

type Props = {
  sort: ValidSort;
  defaultResourceTypes?: string[];
};

function ResourceTable({sort, defaultResourceTypes}: Props) {
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);

  const {data, isLoading, pageLinks} = useResourcesQuery({
    sort,
    defaultResourceTypes,
    cursor,
  });

  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: SPAN_DESCRIPTION, width: COL_WIDTH_UNDEFINED, name: t('Resource Description')},
    {key: SPAN_OP, width: COL_WIDTH_UNDEFINED, name: t('Type')},
    {
      key: `${SPM}()`,
      width: COL_WIDTH_UNDEFINED,
      name: getThroughputTitle('http'),
    },
    {key: `avg(${SPAN_SELF_TIME})`, width: COL_WIDTH_UNDEFINED, name: DataTitles.avg},
    {
      key: `${TIME_SPENT_PERCENTAGE}()`,
      width: COL_WIDTH_UNDEFINED,
      name: DataTitles.timeSpent,
    },
    {
      key: `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
      width: COL_WIDTH_UNDEFINED,
      name: DataTitles['avg(http.response_content_length)'],
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
    const getIcon = (spanOp: string, fileExtension: string) => {
      if (spanOp === 'resource.script') {
        return 'javascript';
      }
      if (fileExtension === 'css') {
        return 'css';
      }
      return 'unknown';
    };

    if (key === SPAN_DESCRIPTION) {
      return (
        <DescriptionWrapper>
          <PlatformIcon
            platform={getIcon(row[SPAN_OP], row[FILE_EXTENSION]) || 'unknown'}
          />
          <SpanDescriptionCell
            moduleName={ModuleName.HTTP}
            projectId={row[PROJECT_ID]}
            description={row[SPAN_DESCRIPTION]}
            group={row[SPAN_GROUP]}
          />
        </DescriptionWrapper>
      );
    }
    if (key === 'spm()') {
      return <ThroughputCell rate={row[key]} unit={RESOURCE_THROUGHPUT_UNIT} />;
    }
    if (key === 'avg(http.response_content_length)') {
      return <ResourceSizeCell bytes={row[key]} />;
    }
    if (key === `avg(span.self_time)`) {
      return <DurationCell milliseconds={row[key]} />;
    }
    if (key === SPAN_OP) {
      const fileExtension = row[SPAN_DESCRIPTION].split('.').pop() || '';
      const spanOp = row[key];
      if (fileExtension === 'js' || spanOp === 'resource.script') {
        return <span>{t('JavaScript')}</span>;
      }
      if (fileExtension === 'css') {
        return <span>{t('Stylesheet')}</span>;
      }
      if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(fileExtension)) {
        return <span>{t('Font')}</span>;
      }
      return <span>{spanOp}</span>;
    }
    if (key === 'http.decoded_response_content_length') {
      const isUncompressed =
        row['http.response_content_length'] ===
        row['http.decoded_response_content_length'];
      return <span>{isUncompressed ? t('true') : t('false')}</span>;
    }
    if (key === 'time_spent_percentage()') {
      return (
        <TimeSpentCell percentage={row[key]} total={row[`sum(${SPAN_SELF_TIME})`]} />
      );
    }
    return <span>{row[key]}</span>;
  };

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: newCursor},
    });
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
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

export default ResourceTable;

const DescriptionWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;
