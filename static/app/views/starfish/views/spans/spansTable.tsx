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
import {defined} from 'sentry/utils';
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
  'p95(span.self_time)': number;
  'span.description': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
  'sps()': number;
  'time_spent_percentage()': number;
  'time_spent_percentage(local)': number;
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

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_DOMAIN, SPAN_GROUP, SPAN_OP} =
  SpanMetricsFields;

const SORTABLE_FIELDS = new Set([
  `p95(${SPAN_SELF_TIME})`,
  `percentile_percent_change(${SPAN_SELF_TIME}, 0.95)`,
  'sps()',
  'sps_percent_change()',
  'time_spent_percentage()',
  'time_spent_percentage(local)',
  'http_error_count()',
  'http_error_count_percent_change()',
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
    'api.starfish.use-span-list',
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
        hasData={(data?.length ?? 0) > 0}
        isLoading={isLoading}
        disabled={shouldTrackVCD}
      >
        <GridEditable
          isLoading={isLoading}
          data={data as Row[]}
          columnOrder={columnOrder ?? getColumns(moduleName, spanCategory, endpoint)}
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
  if (column.key === SPAN_DESCRIPTION) {
    const queryString = {
      ...location.query,
      endpoint,
      endpointMethod,
    };
    return (
      <OverflowEllipsisTextContainer>
        {row[SPAN_GROUP] ? (
          <Link
            to={`/starfish/${extractRoute(location) ?? 'spans'}/span/${row[SPAN_GROUP]}${
              queryString ? `?${qs.stringify(queryString)}` : ''
            }`}
          >
            {row[SPAN_DESCRIPTION] || '<null>'}
          </Link>
        ) : (
          row[SPAN_DESCRIPTION] || '<null>'
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
function getDescriptionHeader(moduleName: ModuleName, spanCategory?: string) {
  if (moduleName === ModuleName.HTTP) {
    return 'URL Request';
  }
  if (moduleName === ModuleName.DB) {
    return 'Database Query';
  }
  if (spanCategory === 'cache') {
    return 'Cache Query';
  }
  if (spanCategory === 'serialize') {
    return 'Serializer';
  }
  if (spanCategory === 'middleware') {
    return 'Middleware';
  }
  if (spanCategory === 'app') {
    return 'Application Task';
  }
  if (moduleName === 'other') {
    return 'Requests';
  }
  return 'Description';
}

function getColumns(
  moduleName: ModuleName,
  spanCategory?: string,
  transaction?: string
): Column[] {
  const description = getDescriptionHeader(moduleName, spanCategory);

  const domain = getDomainHeader(moduleName);

  const order = [
    // We don't show the operation selector in specific modules, so there's no
    // point having that column
    [ModuleName.ALL, ModuleName.OTHER].includes(moduleName)
      ? {
          key: SPAN_OP,
          name: 'Operation',
          width: 120,
        }
      : undefined,
    {
      key: SPAN_DESCRIPTION,
      name: description,
      width: COL_WIDTH_UNDEFINED,
    },
    ...(moduleName !== ModuleName.ALL
      ? [
          {
            key: SPAN_DOMAIN,
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
      key: `p95(${SPAN_SELF_TIME})`,
      name: DataTitles.p95,
      width: COL_WIDTH_UNDEFINED,
    },
    ...(moduleName === ModuleName.HTTP
      ? [
          {
            key: 'http_error_count()',
            name: DataTitles.errorCount,
            width: COL_WIDTH_UNDEFINED,
          } as Column,
        ]
      : []),
  ];

  if (defined(transaction)) {
    order.push({
      key: 'time_spent_percentage(local)',
      name: DataTitles.timeSpent,
      width: COL_WIDTH_UNDEFINED,
    });
  } else {
    order.push({
      key: 'time_spent_percentage()',
      name: DataTitles.timeSpent,
      width: COL_WIDTH_UNDEFINED,
    });
  }

  return order.filter((item): item is NonNullable<Column> => Boolean(item));
}

export function isAValidSort(sort: Sort): sort is ValidSort {
  return SORTABLE_FIELDS.has(sort.field);
}
