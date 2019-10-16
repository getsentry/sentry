import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';

import GridEditable from 'app/components/gridEditable';

import {getFieldRenderer, setColumnStateOnLocation, getAggregateAlias} from '../utils';
import EventView from '../eventView';
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

    const columnOrder = eventView.getColumns();
    const columnSortBy = eventView.getSorts();

    const nextColumnOrder = [...columnOrder, nextColumn];
    const nextColumnSortBy = [...columnSortBy];

    setColumnStateOnLocation(location, nextColumnOrder, nextColumnSortBy);
  };

  /**
   * Please read the comment on `createColumn`
   */
  _updateColumn = (i: number, nextColumn: TableColumn<keyof TableDataRow>) => {
    const {location, eventView} = this.props;

    const columnOrder = eventView.getColumns();
    const columnSortBy = eventView.getSorts();

    if (columnOrder[i].key !== nextColumn.key) {
      throw new Error(
        'TableView.updateColumn: nextColumn does not have the same key as prevColumn'
      );
    }

    const nextColumnOrder = [...columnOrder];
    const nextColumnSortBy = [...columnSortBy];
    nextColumnOrder[i] = nextColumn;

    history.pushState({}, 'omg', '?woah=true');

    if ((window as any).FOOOOOO) {
      setColumnStateOnLocation(location, nextColumnOrder, nextColumnSortBy);
    }
  };

  /**
   * Please read the comment on `createColumn`
   */
  _deleteColumn = (i: number) => {
    const {location, eventView} = this.props;

    const columnOrder = eventView.getColumns();
    const columnSortBy = eventView.getSorts();

    const nextColumnOrder = [...columnOrder];
    const nextColumnSortBy = [...columnSortBy];

    // Disallow delete of last column and check for out-of-bounds
    if (columnOrder.length === 1 || nextColumnOrder.length <= i) {
      return;
    }

    // Remove column from columnOrder
    const deletedColumn = nextColumnOrder.splice(i, 1)[0];

    // Remove column from columnSortBy (if it is there)
    // EventView will throw an error if sorting by a column that isn't displayed
    const j = nextColumnSortBy.findIndex(c => c.key === deletedColumn.key);
    if (j >= 0) {
      nextColumnSortBy.splice(j, 1);
    }

    setColumnStateOnLocation(location, nextColumnOrder, nextColumnSortBy);
  };

  /**
   * Please read the comment on `createColumn`
   */
  _moveColumn = (fromIndex: number, toIndex: number) => {
    const {location, eventView} = this.props;

    const columnOrder = eventView.getColumns();
    const columnSortBy = eventView.getSorts();

    const nextColumnOrder = [...columnOrder];
    const nextColumnSortBy = [...columnSortBy];
    nextColumnOrder.splice(toIndex, 0, nextColumnOrder.splice(fromIndex, 1)[0]);

    setColumnStateOnLocation(location, nextColumnOrder, nextColumnSortBy);
  };

  _renderGridHeaderCell = (column: TableColumn<keyof TableDataRow>): React.ReactNode => {
    const {eventView, location, tableData} = this.props;
    if (!tableData) {
      return column.name;
    }

    const columnField = String(column.key);

    const sortKey = eventView.getSortKey(columnField, tableData.meta);

    if (sortKey === null) {
      return <span>{column.name}</span>;
    }

    const defaultSort = eventView.getDefaultSort() || eventView.fields[0].field;

    const alignedTypes: ColumnValueType[] = ['number', 'duration'];
    let align: 'right' | 'left' = alignedTypes.includes(column.type) ? 'right' : 'left';

    // TODO(alberto): clean this
    if (column.type === 'never' || column.type === '*') {
      const maybeType = tableData.meta[getAggregateAlias(columnField)];

      if (maybeType === 'integer' || maybeType === 'number') {
        align = 'right';
      }
    }

    return (
      <SortLink
        align={align}
        defaultSort={defaultSort}
        sortKey={sortKey}
        title={column.name}
        location={location}
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
