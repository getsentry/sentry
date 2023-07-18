import {Fragment} from 'react';
import {LocationDescriptorObject} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import EventView, {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getAlignment} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {generateMobileServiceSavedQuery} from 'sentry/views/starfish/utils/generatePerformanceEventView';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type TableColumnKeys =
  | 'transaction'
  | 'eps()'
  | 'p75(measurements.frames_slow_rate)'
  | 'p75(measurements.time_to_initial_display)';
type MobileViewsColumn = GridColumnOrder<TableColumnKeys>;
type Column = GridColumnHeader<TableColumnKeys>;
type MobileViewsRow = Record<TableColumnKeys, any>;

const COLUMN_ORDER: MobileViewsColumn[] = [
  {
    key: 'transaction',
    name: t('Screen'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'eps()',
    name: DataTitles.throughput,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p75(measurements.frames_slow_rate)',
    name: DataTitles.slowFrames,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p75(measurements.time_to_initial_display)',
    name: DataTitles.ttid,
    width: COL_WIDTH_UNDEFINED,
  },
];

export function ViewsList() {
  const location = useLocation();
  const organization = useOrganization();
  const savedQuery = generateMobileServiceSavedQuery(location);
  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  const {isLoading, data, meta, pageLinks} = useViewsList(eventView);

  function renderHeadCell({column, tableMeta}) {
    const {key} = column;
    const alignment = getAlignment(key);
    const field = {
      field: column.key,
      width: column.width,
    };

    function generateSortLink(): LocationDescriptorObject | undefined {
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

  function renderBodyCell(column: Column, row: MobileViewsRow): React.ReactNode {
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

  return (
    <Fragment>
      <VisuallyCompleteWithData
        id="MobileServiceView.ViewsList"
        hasData={defined(data) && data.length > 0}
      >
        <GridEditable
          isLoading={isLoading}
          data={data ?? []}
          columnOrder={COLUMN_ORDER}
          columnSortBy={eventView.getSorts() as any}
          grid={{
            renderHeadCell: column => renderHeadCell({column, tableMeta: meta}),
            renderBodyCell,
          }}
          location={location}
        />
      </VisuallyCompleteWithData>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

export const useViewsList = (eventView: EventView) => {
  const {isLoading, data, meta, pageLinks} = useWrappedDiscoverQuery<MobileViewsRow[]>({
    eventView,
    initialData: [],
    limit: 50,
  });

  return {isLoading, data, meta, pageLinks};
};
