import {Fragment} from 'react';

import {getInterval} from 'sentry/components/charts/utils';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Pagination from 'sentry/components/pagination';
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
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = {
  'avg(measurements.time_to_full_display)': number;
  'avg(measurements.time_to_initial_display)': number;
  'count()': number;
  transaction: string;
};

type Column = GridColumnHeader<keyof Row>;

export function ScreensTable() {
  const {selection} = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const {query} = location;
  const orderby = decodeScalar(query.sort, `-count`);
  const newQuery: NewQuery = {
    name: '',
    fields: [
      'transaction',
      'count()',
      'avg(measurements.time_to_initial_display)',
      'avg(measurements.time_to_full_display)',
    ],
    topEvents: '6',
    query: 'transaction.op:ui.load',
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
    interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
  };
  newQuery.orderby = orderby;
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {data, isLoading, pageLinks} = useScreensList({eventView});
  const columnOrder: Column[] = [
    {
      key: 'transaction',
      name: 'Screen',
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'avg(measurements.time_to_initial_display)',
      name: DataTitles.ttid,
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'avg(measurements.time_to_full_display)',
      name: DataTitles.ttfd,
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'count()',
      name: DataTitles.count,
      width: COL_WIDTH_UNDEFINED,
    },
  ];

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
        columnOrder={columnOrder}
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
