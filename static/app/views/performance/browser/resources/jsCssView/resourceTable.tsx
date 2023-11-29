import {Fragment, useEffect} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';
import {PLATFORM_TO_ICON} from 'platformicons/build/platformIcon';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, usePageError} from 'sentry/utils/performance/contexts/pageError';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/performance/browser/resources';
import {FONT_FILE_EXTENSIONS} from 'sentry/views/performance/browser/resources/shared/constants';
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
} = SpanMetricsField;

const {TIME_SPENT_PERCENTAGE} = SpanFunction;

const {SPM} = SpanFunction;

const RESOURCE_SIZE_ALERT: PageAlert = {
  type: 'info',
  message: t(
    `If you're noticing unusually large resource sizes, try updating to SDK version 7.82.0 or higher.`
  ),
};

type Row = {
  'avg(http.response_content_length)': number;
  'avg(span.self_time)': number;
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
  const {setPageError, pageError} = usePageError();

  const {data, isLoading, pageLinks} = useResourcesQuery({
    sort,
    defaultResourceTypes,
    cursor,
    referrer: 'api.performance.browser.resources.main-table',
  });

  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: SPAN_DESCRIPTION, width: COL_WIDTH_UNDEFINED, name: t('Resource Description')},
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
  const tableData: Row[] = data;

  useEffect(() => {
    if (pageError !== RESOURCE_SIZE_ALERT) {
      for (const row of tableData) {
        const encodedSize = row[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`];
        if (encodedSize >= 2147483647) {
          setPageError(RESOURCE_SIZE_ALERT);
          break;
        }
      }
    }
  }, [tableData, setPageError, pageError]);

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    const getIcon = (
      spanOp: string,
      fileExtension: string
    ): keyof typeof PLATFORM_TO_ICON | 'unknown' => {
      if (spanOp === 'resource.script') {
        return 'javascript';
      }
      if (fileExtension === 'css') {
        return 'css';
      }
      if (FONT_FILE_EXTENSIONS.includes(fileExtension)) {
        return 'font';
      }
      return 'unknown';
    };

    if (key === SPAN_DESCRIPTION) {
      const fileExtension = row[SPAN_DESCRIPTION].split('.').pop() || '';

      return (
        <DescriptionWrapper>
          <PlatformIcon platform={getIcon(row[SPAN_OP], fileExtension) || 'unknown'} />
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
      if (FONT_FILE_EXTENSIONS.includes(fileExtension)) {
        return <span>{t('Font')}</span>;
      }
      return <span>{spanOp}</span>;
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
