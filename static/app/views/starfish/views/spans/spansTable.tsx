import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {Organization} from 'sentry/types';
import {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {useSpanList} from 'sentry/views/starfish/queries/useSpanList';
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = {
  'http_error_count()': number;
  'http_error_count_percent_change()': number;
  'p95(span.self_time)': number;
  'percentile_percent_change(span.self_time, 0.95)': number;
  'span.description': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
  'sps()': number;
  'sps_percent_change()': number;
  'time_spent_percentage()': number;
};

type Column = GridColumnHeader<keyof Row>;

type ValidSort = Sort & {
  field: keyof Row;
};

type Props = {
  moduleName: ModuleName;
  sort: ValidSort;
  columnOrder?: Column[];
  endpoint?: string;
  limit?: number;
  method?: string;
  spanCategory?: string;
};

const {SPAN_SELF_TIME} = SpanMetricsFields;

export const SORTABLE_FIELDS = new Set([
  `p95(${SPAN_SELF_TIME})`,
  `percentile_percent_change(${SPAN_SELF_TIME}, 0.95)`,
  'sps()',
  'sps_percent_change()',
  'time_spent_percentage()',
]);

export default function SpansTable({
  moduleName,
  sort,
  columnOrder,
  spanCategory,
  endpoint,
  method,
  limit = 25,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const spansCursor = decodeScalar(location.query?.[QueryParameterNames.CURSOR]);

  const {isLoading, data, meta, pageLinks} = useSpanList(
    moduleName ?? ModuleName.ALL,
    endpoint,
    method,
    spanCategory,
    [sort],
    limit,
    'use-span-list',
    spansCursor
  );

  const handleCursor: CursorHandler = (cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.CURSOR]: cursor},
    });
  };

  const shouldTrackVCD = Boolean(endpoint);

  return (
    <Fragment>
      <VisuallyCompleteWithData
        id="SpansTable"
        hasData={data.length > 0}
        isLoading={isLoading}
        disabled={shouldTrackVCD}
      >
        <GridEditable
          isLoading={isLoading}
          data={data as Row[]}
          columnOrder={columnOrder ?? getColumns(moduleName)}
          columnSortBy={[
            {
              key: sort.field,
              order: sort.kind,
            },
          ]}
          grid={{
            renderHeadCell: column => renderHeadCell({column, sort, location}),
            renderBodyCell: (column, row) =>
              renderBodyCell(column, row, meta, location, organization, endpoint, method),
          }}
          location={location}
        />
        <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
      </VisuallyCompleteWithData>
    </Fragment>
  );
}

function renderBodyCell(
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization,
  endpoint?: string,
  endpointMethod?: string
): React.ReactNode {
  if (column.key === 'span.description') {
    const queryString = {
      endpoint,
      endpointMethod,
    };
    return (
      <OverflowEllipsisTextContainer>
        {row['span.group'] ? (
          <Link
            to={`/starfish/${extractRoute(location) ?? 'spans'}/span/${
              row['span.group']
            }${queryString ? `?${qs.stringify(queryString)}` : ''}`}
          >
            {row['span.description'] || '<null>'}
          </Link>
        ) : (
          row['span.description'] || '<null>'
        )}
      </OverflowEllipsisTextContainer>
    );
  }

  if (!meta || !meta?.fields) {
    return row[column.key];
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);

  const rendered = renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
  });

  return rendered;
}

function getDomainHeader(moduleName: ModuleName) {
  if (moduleName === ModuleName.HTTP) {
    return 'Host';
  }
  if (moduleName === ModuleName.DB) {
    return 'Table';
  }
  return 'Domain';
}
function getDescriptionHeader(moduleName: ModuleName) {
  if (moduleName === ModuleName.HTTP) {
    return 'URL';
  }
  if (moduleName === ModuleName.DB) {
    return 'Query';
  }
  return 'Description';
}

function getColumns(moduleName: ModuleName): Column[] {
  const description = getDescriptionHeader(moduleName);

  const domain = getDomainHeader(moduleName);

  const order: Column[] = [
    {
      key: 'span.op',
      name: 'Operation',
      width: 120,
    },
    {
      key: 'span.description',
      name: description,
      width: COL_WIDTH_UNDEFINED,
    },
    ...(moduleName !== ModuleName.ALL
      ? [
          {
            key: 'span.domain',
            name: domain,
            width: COL_WIDTH_UNDEFINED,
          } as Column,
        ]
      : []),
    {
      key: 'sps()',
      name: 'Throughput',
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'sps_percent_change()',
      name: DataTitles.change,
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: `p95(${SPAN_SELF_TIME})`,
      name: DataTitles.p95,
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: `percentile_percent_change(${SPAN_SELF_TIME}, 0.95)`,
      name: DataTitles.change,
      width: COL_WIDTH_UNDEFINED,
    },
    ...(moduleName === ModuleName.HTTP
      ? [
          {
            key: 'http_error_count()',
            name: DataTitles.errorCount,
            width: COL_WIDTH_UNDEFINED,
          } as Column,
          {
            key: 'http_error_count_percent_change()',
            name: DataTitles.change,
            width: COL_WIDTH_UNDEFINED,
          } as Column,
        ]
      : []),
    {
      key: 'time_spent_percentage()',
      name: DataTitles.timeSpent,
      width: COL_WIDTH_UNDEFINED,
    },
  ];

  return order;
}

export function isAValidSort(sort: Sort): sort is ValidSort {
  return SORTABLE_FIELDS.has(sort.field);
}
