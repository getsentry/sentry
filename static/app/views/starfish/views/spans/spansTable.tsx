import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import pickBy from 'lodash/pickBy';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {Organization} from 'sentry/types';
import {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanDescriptionCell} from 'sentry/views/starfish/components/tableCells/spanDescriptionCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import type {ValidSort} from 'sentry/views/starfish/views/spans/useModuleSort';

type Row = {
  'avg(span.self_time)': number;
  'http_error_count()': number;
  'span.description': string;
  'span.domain': Array<string>;
  'span.group': string;
  'span.op': string;
  'spm()': number;
  'time_spent_percentage()': number;
};

type Column = GridColumnHeader<keyof Row>;

type Props = {
  moduleName: ModuleName;
  sort: ValidSort;
  columnOrder?: Column[];
  endpoint?: string;
  limit?: number;
  method?: string;
  spanCategory?: string;
};

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID, SPAN_DOMAIN} =
  SpanMetricsField;

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

  const spanDescription = decodeScalar(location.query?.['span.description']);
  const spanAction = decodeScalar(location.query?.['span.action']);
  const spanDomain = decodeScalar(location.query?.['span.domain']);
  const cursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);

  const filters = {
    'span.description': spanDescription ? `*${spanDescription}*` : undefined,
    'span.action': spanAction,
    'span.domain': spanDomain,
    'span.module': moduleName ?? ModuleName.ALL,
    transaction: endpoint,
    'transaction.method': method,
    has: 'span.description',
  };

  const {isLoading, data, meta, pageLinks} = useSpanMetrics(
    pickBy(filters, value => value !== undefined),
    [
      PROJECT_ID,
      SPAN_OP,
      SPAN_GROUP,
      SPAN_DESCRIPTION,
      SPAN_DOMAIN,
      'spm()',
      `sum(${SPAN_SELF_TIME})`,
      `avg(${SPAN_SELF_TIME})`,
      'http_error_count()',
      'time_spent_percentage()',
    ],
    [sort],
    limit,
    cursor,
    'api.starfish.use-span-list'
  );

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: newCursor},
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
          columnOrder={columnOrder ?? getColumns(moduleName, spanCategory)}
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
                sort,
                location,
                sortParameterName: QueryParameterNames.SPANS_SORT,
              }),
            renderBodyCell: (column, row) =>
              renderBodyCell(
                column,
                row,
                moduleName,
                meta,
                location,
                organization,
                endpoint,
                method
              ),
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
  moduleName: ModuleName,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization,
  endpoint?: string,
  endpointMethod?: string
) {
  if (column.key === SPAN_DESCRIPTION) {
    return (
      <SpanDescriptionCell
        moduleName={moduleName}
        description={row[SPAN_DESCRIPTION]}
        group={row[SPAN_GROUP]}
        projectId={row[PROJECT_ID]}
        endpoint={endpoint}
        endpointMethod={endpointMethod}
      />
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
    return 'Query Description';
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

function getColumns(moduleName: ModuleName, spanCategory?: string): Column[] {
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
    ...(moduleName !== ModuleName.ALL && moduleName !== ModuleName.DB
      ? [
          {
            key: SPAN_DOMAIN,
            name: domain,
            width: COL_WIDTH_UNDEFINED,
          } as Column,
        ]
      : []),
    {
      key: 'spm()',
      name: getThroughputTitle(moduleName),
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: `avg(${SPAN_SELF_TIME})`,
      name: DataTitles.avg,
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
    {
      key: 'time_spent_percentage()',
      name: DataTitles.timeSpent,
      width: COL_WIDTH_UNDEFINED,
    },
  ];

  return order.filter((item): item is NonNullable<Column> => Boolean(item));
}
