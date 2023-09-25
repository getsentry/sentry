import {Fragment} from 'react';

import {getInterval} from 'sentry/components/charts/utils';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
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
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

export function ScreensTable() {
  const {selection} = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
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
      'avg(measurements.time_to_initial_display)', // TODO: Update these to avgIf with primary release when available
      `avg_compare(measurements.time_to_initial_display,release,${primaryRelease},${secondaryRelease})`,
      'avg(measurements.time_to_full_display)',
      `avg_compare(measurements.time_to_full_display,release,${primaryRelease},${secondaryRelease})`,
      'count()',
    ],
    topEvents: '6',
    query: queryStringPrimary,
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
    interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
  };
  newQuery.orderby = orderby;
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {data, isLoading, pageLinks} = useScreensList({
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
        columnOrder={eventViewColumns.map((col: TableColumn<React.ReactText>) => {
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

export function useScreensList({
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
    limit: 10,
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
