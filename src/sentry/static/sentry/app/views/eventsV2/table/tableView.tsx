import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';

import GridEditable from 'app/components/gridEditable';

import {getFieldRenderer, getAggregateAlias, pushEventViewToLocation} from '../utils';
import EventView, {getSortKeyFromField} from '../eventView';
import SortLink from '../sortLink';
import renderTableModalEditColumnFactory from './tableModalEditColumn';
import {TableColumn, TableData, TableDataRow} from './types';
import {ColumnValueType} from '../eventQueryParams';

export type TableViewProps = {
  location: Location;
  organization: Organization;

  isLoading: boolean;
  error: string | null;

  eventView: EventView;
  tableData: TableData | null | undefined;
};

/**
 * `TableView` is currently in turmoil as it is containing 2 implementations
 * of the Discover V2 QueryBuilder.
 *
 * The old `TableView` is split away from `table.tsx` file as it was too long
 * and its methods have not been changed. It reads its state from `EventView`,
 * which is shared across several component.
 *
 * The new `TableView` is marked with leading _ in its method names. It
 * is coupled to the `Location` object and derives its state entirely from it.
 * It implements methods to mutate the column state in `Location.query`.
 */
class TableView extends React.Component<TableViewProps> {
  // TODO: update this docs
  /**
   * The "truth" on the state of the columns is found in `Location`,
   * `createColumn`, `updateColumn`, `deleteColumn` and `moveColumn`.
   * Syncing the state between `Location` and `TableView` may cause weird
   * side-effects, as such the local state is not allowed to be mutated.
   *
   * State change should be done through  `setColumnStateOnLocation` which will
   * update the `Location` object and changes are propagated downwards to child
   * components
   */
  _createColumn = (nextColumn: TableColumn<keyof TableDataRow>) => {
    const {location, eventView} = this.props;

    const nextEventView = eventView.createColumn({
      aggregation: String(nextColumn.aggregation),
      field: String(nextColumn.field),
      fieldname: nextColumn.name,
    });

    pushEventViewToLocation({
      location,
      currentEventView: eventView,
      nextEventView,
    });
  };

  /**
   * Please read the comment on `createColumn`
   */
  _updateColumn = (columnIndex: number, nextColumn: TableColumn<keyof TableDataRow>) => {
    const {location, eventView} = this.props;

    const nextEventView = eventView.updateColumn(columnIndex, {
      aggregation: String(nextColumn.aggregation),
      field: String(nextColumn.field),
      fieldname: nextColumn.name,
    });

    pushEventViewToLocation({
      location,
      currentEventView: eventView,
      nextEventView,
    });
  };

  /**
   * Please read the comment on `createColumn`
   */
  _deleteColumn = (columnIndex: number) => {
    const {location, eventView, tableData} = this.props;

    if (!tableData) {
      return;
    }

    const nextEventView = eventView.deleteColumn(columnIndex, tableData.meta);

    pushEventViewToLocation({
      location,
      currentEventView: eventView,
      nextEventView,
    });
  };

  /**
   * Please read the comment on `createColumn`
   */
  _moveColumn = (fromIndex: number, toIndex: number) => {
    const {location, eventView} = this.props;

    const nextEventView = eventView.moveColumn({fromIndex, toIndex});

    pushEventViewToLocation({
      location,
      currentEventView: eventView,
      nextEventView,
    });
  };

  _renderGridHeaderCell = (
    column: TableColumn<keyof TableDataRow>,
    columnIndex: number
  ): React.ReactNode => {
    const {eventView, location, tableData} = this.props;
    if (!tableData) {
      return column.name;
    }

    const field = eventView.fields[columnIndex];

    const sortKey = getSortKeyFromField(field, tableData.meta);

    if (sortKey === null) {
      return <span>{column.name}</span>;
    }

    const alignedTypes: ColumnValueType[] = ['number', 'duration'];
    let align: 'right' | 'left' = alignedTypes.includes(column.type) ? 'right' : 'left';

    // TODO(alberto): clean this
    if (column.type === 'never' || column.type === '*') {
      const maybeType = tableData.meta[getAggregateAlias(field.field)];

      if (maybeType === 'integer' || maybeType === 'number') {
        align = 'right';
      }
    }

    return (
      <SortLink
        align={align}
        field={field}
        location={location}
        eventView={eventView}
        tableDataMeta={tableData.meta}
      />
    );
  };

  _renderGridBodyCell = (
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode => {
    const {location, organization, tableData, eventView} = this.props;
    if (!tableData) {
      return dataRow[column.key];
    }
    const hasLinkField = eventView.hasAutolinkField();
    const forceLink =
      !hasLinkField && eventView.getFields().indexOf(String(column.field)) === 0;

    const fieldRenderer = getFieldRenderer(String(column.key), tableData.meta, forceLink);
    return fieldRenderer(dataRow, {organization, location});
  };

  render() {
    const {organization, isLoading, error, tableData, eventView} = this.props;

    const columnOrder = eventView.getColumns();
    const columnSortBy = eventView.getSorts();

    const {
      renderModalBodyWithForm,
      renderModalFooter,
    } = renderTableModalEditColumnFactory(organization, {
      createColumn: this._createColumn,
      updateColumn: this._updateColumn,
    });

    return (
      <GridEditable
        isEditable
        isLoading={isLoading}
        error={error}
        data={tableData ? tableData.data : []}
        columnOrder={columnOrder}
        columnSortBy={columnSortBy}
        grid={{
          renderHeaderCell: this._renderGridHeaderCell as any,
          renderBodyCell: this._renderGridBodyCell as any,
        }}
        modalEditColumn={{
          renderBodyWithForm: renderModalBodyWithForm as any,
          renderFooter: renderModalFooter,
        }}
        actions={{
          deleteColumn: this._deleteColumn,
          moveColumn: this._moveColumn,
        }}
      />
    );
  }
}

export default TableView;
