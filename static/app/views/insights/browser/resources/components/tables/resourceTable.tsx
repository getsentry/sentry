import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import type {GridColumnHeader, GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {IconImage} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DismissId, usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useResourcesQuery} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import {
  FONT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
} from 'sentry/views/insights/browser/resources/constants';
import {
  DATA_TYPE,
  RESOURCE_THROUGHPUT_UNIT,
} from 'sentry/views/insights/browser/resources/settings';
import {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import type {ValidSort} from 'sentry/views/insights/browser/resources/utils/useResourceSort';
import {DurationCell} from 'sentry/views/insights/common/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import ResourceSizeCell from 'sentry/views/insights/common/components/tableCells/resourceSizeCell';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {ThroughputCell} from 'sentry/views/insights/common/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {ModuleName, SpanFunction, SpanMetricsField} from 'sentry/views/insights/types';

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

const RESOURCE_SIZE_ALERT = t(
  `If you're noticing unusually large resource sizes, try updating to SDK version 7.82.0 or higher.`
);

type Row = {
  'avg(http.response_content_length)': number;
  'avg(span.self_time)': number;
  'project.id': number;
  'span.description': string;
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
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const cursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);
  const filters = useResourceModuleFilters();
  const {setPageInfo, pageAlert} = usePageAlert();

  const {data, isPending, pageLinks} = useResourcesQuery({
    sort,
    defaultResourceTypes,
    cursor,
    referrer: 'api.performance.browser.resources.main-table',
  });

  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {
      key: SPAN_DESCRIPTION,
      width: COL_WIDTH_UNDEFINED,
      name: `${DATA_TYPE} ${t('Description')}`,
    },
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
    if (pageAlert?.message !== RESOURCE_SIZE_ALERT) {
      for (const row of tableData) {
        const encodedSize = row[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`];
        if (encodedSize >= 2147483647) {
          setPageInfo(RESOURCE_SIZE_ALERT, {dismissId: DismissId.RESOURCE_SIZE_ALERT});
          break;
        }
      }
    }
  }, [tableData, setPageInfo, pageAlert?.message]);

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;

    if (key === SPAN_DESCRIPTION) {
      const fileExtension = row[SPAN_DESCRIPTION].split('.').pop() || '';
      const extraLinkQueryParams = {};
      if (filters[SpanMetricsField.USER_GEO_SUBREGION]) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        extraLinkQueryParams[SpanMetricsField.USER_GEO_SUBREGION] =
          filters[SpanMetricsField.USER_GEO_SUBREGION];
      }
      return (
        <DescriptionWrapper>
          <ResourceIcon fileExtension={fileExtension} spanOp={row[SPAN_OP]} />
          <SpanDescriptionCell
            moduleName={ModuleName.RESOURCE}
            projectId={row[PROJECT_ID]}
            spanOp={row[SPAN_OP]}
            description={row[SPAN_DESCRIPTION]}
            group={row[SPAN_GROUP]}
            extraLinkQueryParams={extraLinkQueryParams}
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
        <TimeSpentCell
          percentage={row[key]}
          total={row[`sum(${SPAN_SELF_TIME})`]}
          op={row[SPAN_OP]}
        />
      );
    }
    return <span>{row[key]}</span>;
  };

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: newCursor},
    });
  };

  return (
    <Fragment>
      <GridEditable
        data={tableData}
        isLoading={isPending}
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
      />
      <Pagination
        pageLinks={pageLinks}
        onCursor={handleCursor}
        paginationAnalyticsEvent={(direction: string) => {
          trackAnalytics('insight.general.table_paginate', {
            organization,
            source: ModuleName.RESOURCE,
            direction,
          });
        }}
      />
    </Fragment>
  );
}

function ResourceIcon(props: {fileExtension: string; spanOp: string}) {
  const {spanOp, fileExtension} = props;

  if (spanOp === ResourceSpanOps.SCRIPT) {
    return <PlatformIcon platform="javascript" />;
  }
  if (fileExtension === 'css') {
    return <PlatformIcon platform="css" />;
  }
  if (FONT_FILE_EXTENSIONS.includes(fileExtension)) {
    return <PlatformIcon platform="font" />;
  }
  if (spanOp === ResourceSpanOps.IMAGE || IMAGE_FILE_EXTENSIONS.includes(fileExtension)) {
    return <IconImage color="black" legacySize="20px" />;
  }
  return <PlatformIcon platform="unknown" />;
}

export default ResourceTable;

const DescriptionWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;
