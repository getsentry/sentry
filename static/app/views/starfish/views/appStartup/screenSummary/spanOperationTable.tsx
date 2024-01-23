import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import * as qs from 'query-string';

import {getInterval} from 'sentry/components/charts/utils';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {NewQuery} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {
  fromSorts,
  isFieldSortable,
  MetaType,
} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {SpanOpSelector} from 'sentry/views/starfish/views/appStartup/screenSummary/spanOpSelector';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {MobileCursors} from 'sentry/views/starfish/views/screens/constants';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} =
  SpanMetricsField;

type Props = {
  primaryRelease?: string;
  secondaryRelease?: string;
  transaction?: string;
};

const IOS_STARTUP_SPANS = ['app.start.cold', 'app.start.warm'];
const ANDROID_STARTUP_SPANS = [
  'app.start.cold',
  'app.start.warm',
  'contentprovider.load',
  'application.load',
  'activity.load',
];
export const STARTUP_SPANS = new Set([...IOS_STARTUP_SPANS, ...ANDROID_STARTUP_SPANS]);

export function SpanOperationTable({
  transaction,
  primaryRelease,
  secondaryRelease,
}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const cursor = decodeScalar(location.query?.[MobileCursors.SPANS_TABLE]);

  const spanOp = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const truncatedPrimary = formatVersionAndCenterTruncate(primaryRelease ?? '', 15);
  const truncatedSecondary = formatVersionAndCenterTruncate(secondaryRelease ?? '', 15);

  const searchQuery = new MutableSearch([
    'transaction.op:ui.load',
    `transaction:${transaction}`,
    'has:span.description',
    // Exclude root level spans because they're comprised of nested operations
    '!span.description:"Cold Start"',
    '!span.description:"Warm Start"',
    ...(spanOp
      ? [`${SpanMetricsField.SPAN_OP}:${spanOp}`]
      : [`span.op:[${[...STARTUP_SPANS].join(',')}]`]),
  ]);
  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const sort = fromSorts(
    decodeScalar(location.query[QueryParameterNames.SPANS_SORT])
  )[0] ?? {
    kind: 'desc',
    field: 'time_spent_percentage()',
  };

  const newQuery: NewQuery = {
    name: '',
    fields: [
      PROJECT_ID,
      SPAN_OP,
      SPAN_GROUP,
      SPAN_DESCRIPTION,
      `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
      `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
      'count()',
      'time_spent_percentage()',
      `sum(${SPAN_SELF_TIME})`,
    ],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
    interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  eventView.sorts = [sort];

  const {data, isLoading, pageLinks} = useTableQuery({
    eventView,
    enabled: true,
    referrer: 'api.starfish.mobile-spartup-span-table',
    cursor,
  });

  const columnNameMap = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
    'count()': t('Total Count'),
    [`avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`]: t(
      'Duration (%s)',
      truncatedPrimary
    ),
    [`avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`]: t(
      'Duration (%s)',
      truncatedSecondary
    ),
    ['time_spent_percentage()']: t('Total Time Spent'),
  };

  function renderBodyCell(column, row): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanMetricsField.SPAN_DESCRIPTION];

      const pathname = normalizeUrl(
        `/organizations/${organization.slug}/performance/mobile/app-startup/spans/`
      );
      const query = {
        ...location.query,
        transaction,
        spanOp: row[SpanMetricsField.SPAN_OP],
        spanGroup: row[SpanMetricsField.SPAN_GROUP],
        spanDescription: row[SpanMetricsField.SPAN_DESCRIPTION],
      };

      return (
        <Link to={`${pathname}?${qs.stringify(query)}`}>
          <OverflowEllipsisTextContainer>{label}</OverflowEllipsisTextContainer>
        </Link>
      );
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
    return rendered;
  }

  function renderHeadCell(
    column: GridColumnHeader,
    tableMeta?: MetaType
  ): React.ReactNode {
    const fieldType = tableMeta?.fields?.[column.key];

    const alignment = fieldAlignment(column.key as string, fieldType);
    const field = {
      field: column.key as string,
      width: column.width,
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === column.key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      function getNewSort() {
        return `${newSortDirection === 'desc' ? '-' : ''}${column.key}`;
      }

      return {
        ...location,
        query: {...location.query, [QueryParameterNames.SPANS_SORT]: getNewSort()},
      };
    }

    const canSort = isFieldSortable(field, tableMeta?.fields, true);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={sort?.field === column.key ? sort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  const columnSortBy = eventView.getSorts();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [MobileCursors.SPANS_TABLE]: newCursor},
    });
  };

  return (
    <Fragment>
      <SpanOpSelector
        primaryRelease={primaryRelease}
        transaction={transaction}
        secondaryRelease={secondaryRelease}
      />
      <GridEditable
        isLoading={isLoading}
        data={data?.data as TableDataRow[]}
        columnOrder={[
          String(SPAN_OP),
          String(SPAN_DESCRIPTION),
          `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
          `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
          'count()',
          'time_spent_percentage()',
        ].map(col => {
          return {key: col, name: columnNameMap[col] ?? col, width: COL_WIDTH_UNDEFINED};
        })}
        columnSortBy={columnSortBy}
        location={location}
        grid={{
          renderHeadCell: column => renderHeadCell(column, data?.meta),
          renderBodyCell,
        }}
      />
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}
