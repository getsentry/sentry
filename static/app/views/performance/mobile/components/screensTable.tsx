import {Fragment} from 'react';

import type {
  GridColumn,
  GridColumnHeader,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Pagination from 'sentry/components/pagination';
import {defined} from 'sentry/utils';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  columnNameMap: Record<string, string>;
  columnOrder: string[];
  data: TableData | undefined;
  defaultSort: GridColumnSortBy<string>[];
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
  customBodyCellRenderer?: (
    column: GridColumn<string>,
    row: TableDataRow
  ) => React.ReactNode | null;
};

export function ScreensTable({
  data,
  eventView,
  isLoading,
  pageLinks,
  columnNameMap,
  columnOrder,
  defaultSort,
  customBodyCellRenderer,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  function renderBodyCell(
    column: GridColumn<string>,
    row: TableDataRow
  ): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    if (defined(customBodyCellRenderer)) {
      const customRenderedCell = customBodyCellRenderer(column, row);
      if (defined(customRenderedCell)) {
        return customRenderedCell;
      }
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    return renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
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
        columnOrder={columnOrder.map(columnKey => {
          return {
            key: columnKey,
            name: columnNameMap[columnKey],
            width: COL_WIDTH_UNDEFINED,
          };
        })}
        columnSortBy={defaultSort}
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
