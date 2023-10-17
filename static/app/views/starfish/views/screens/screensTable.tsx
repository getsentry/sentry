import {Fragment} from 'react';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {NewQuery} from 'sentry/types';
import {
  TableData,
  TableDataRow,
  useDiscoverQuery,
} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable, MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TableColumn} from 'sentry/views/discover/table/types';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

export function ScreensTable() {
  const {selection} = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const routingContext = useRoutingContext();
  const {query} = location;
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const searchQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
  ]);
  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const orderby = decodeScalar(query.sort, `-count`);
  const newQuery: NewQuery = {
    name: '',
    fields: [
      'transaction',
      SpanMetricsField.PROJECT_ID,
      'avg(measurements.time_to_initial_display)', // TODO: Update these to avgIf with primary release when available
      `avg_compare(measurements.time_to_initial_display,release,${primaryRelease},${secondaryRelease})`,
      'avg(measurements.time_to_full_display)',
      `avg_compare(measurements.time_to_full_display,release,${primaryRelease},${secondaryRelease})`,
      'count()',
    ],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
  };
  newQuery.orderby = orderby;
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {data, isLoading, pageLinks} = useTableQuery({
    eventView,
    enabled: !isReleasesLoading,
  });
  const eventViewColumns = eventView.getColumns();

  const columnNameMap = {
    transaction: t('Screen'),
    'avg(measurements.time_to_initial_display)': DataTitles.ttid,
    'avg(measurements.time_to_full_display)': DataTitles.ttfd,
    'count()': DataTitles.count,
    [`avg_compare(measurements.time_to_initial_display,release,${primaryRelease},${secondaryRelease})`]:
      DataTitles.change,
    [`avg_compare(measurements.time_to_full_display,release,${primaryRelease},${secondaryRelease})`]:
      DataTitles.change,
  };

  function renderBodyCell(column, row): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    const field = String(column.key);

    if (field === 'transaction') {
      return (
        <Link
          to={`${routingContext.baseURL}/pageload/spans/?${qs.stringify({
            ...location.query,
            project: row['project.id'],
            transaction: row.transaction,
            primaryRelease,
            secondaryRelease,
          })}`}
          style={{display: `block`, width: `100%`}}
        >
          {row.transaction}
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

      const nextEventView = eventView.sortOnField(field, tableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, sort: queryStringObject.sort},
      };
    }

    const currentSort = eventView.sortForField(field, tableMeta);
    const currentSortKind = currentSort ? currentSort.kind : undefined;
    const canSort = isFieldSortable(field, tableMeta);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={data?.data as TableDataRow[]}
        columnOrder={eventViewColumns
          .filter(
            (col: TableColumn<React.ReactText>) =>
              col.name !== SpanMetricsField.PROJECT_ID
          )
          .map((col: TableColumn<React.ReactText>) => {
            return {...col, name: columnNameMap[col.key]};
          })}
        columnSortBy={[
          {
            key: 'count()',
            order: 'desc',
          },
        ]}
        location={location}
        grid={{
          renderHeadCell: column => renderHeadCell(column, data?.meta),
          renderBodyCell,
        }}
      />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

export function useTableQuery({
  eventView,
  enabled,
  referrer,
  initialData,
}: {
  eventView: EventView;
  enabled?: boolean;
  excludeOther?: boolean;
  initialData?: TableData;
  referrer?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();

  const result = useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: 25,
    referrer,
    options: {
      refetchOnWindowFocus: false,
      enabled,
    },
  });

  return {
    ...result,
    data: result.isLoading ? initialData : result.data,
    pageLinks: result.pageLinks,
  };
}
