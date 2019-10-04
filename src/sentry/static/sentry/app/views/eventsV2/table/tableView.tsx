import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';

import GridEditable from 'app/components/gridEditable';

import {
  decodeColumnOrder,
  decodeColumnSortBy,
  getFieldRenderer,
  setColumnStateOnLocation,
} from '../utils';
import EventView from '../eventView';
import SortLink from '../sortLink';
import renderTableModalEditColumnFactory from './tableModalEditColumn';
import {TableColumn, TableState, TableData, TableDataRow} from './types';

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
class TableView extends React.Component<TableViewProps, TableState> {
  constructor(props) {
    super(props);

    this.setState = () => {
      throw new Error(
        'TableView: Please do not directly mutate the state of TableView. Please read the comments on TableView.createColumn for more info.'
      );
    };
  }

  state = {
    columnOrder: [],
    columnSortBy: [],
  } as TableState;

  static getDerivedStateFromProps(props: TableViewProps): TableState {
    // Avoid using props.location to get derived state.
    const {eventView} = props;

    return {
      columnOrder: decodeColumnOrder({
        field: eventView.getFieldNames(),
        fieldnames: eventView.getFieldTitles(),
      }),
      columnSortBy: decodeColumnSortBy({
        sort: eventView.getDefaultSort(),
      }),
    };
  }

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
    const {location} = this.props;
    const {columnOrder, columnSortBy} = this.state;
    const nextColumnOrder = [...columnOrder, nextColumn];
    const nextColumnSortBy = [...columnSortBy];

    setColumnStateOnLocation(location, nextColumnOrder, nextColumnSortBy);
  };

  /**
   * Please read the comment on `createColumn`
   */
  _updateColumn = (i: number, nextColumn: TableColumn<keyof TableDataRow>) => {
    const {location} = this.props;
    const {columnOrder, columnSortBy} = this.state;

    if (columnOrder[i].key !== nextColumn.key) {
      throw new Error(
        'TableView.updateColumn: nextColumn does not have the same key as prevColumn'
      );
    }

    const nextColumnOrder = [...columnOrder];
    const nextColumnSortBy = [...columnSortBy];
    nextColumnOrder[i] = nextColumn;

    setColumnStateOnLocation(location, nextColumnOrder, nextColumnSortBy);
  };

  /**
   * Please read the comment on `createColumn`
   */
  _deleteColumn = (i: number) => {
    const {location} = this.props;
    const {columnOrder, columnSortBy} = this.state;
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
    const {location} = this.props;
    const {columnOrder, columnSortBy} = this.state;

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

    // TODO(leedongwei): Deprecate eventView and use state.columnSortBy
    const defaultSort = eventView.getDefaultSort() || eventView.fields[0].field;

    return (
      <SortLink
        defaultSort={defaultSort}
        sortKey={`${column.key}`}
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
      !hasLinkField && eventView.getFieldNames().indexOf(column.field) === 0;

    const fieldRenderer = getFieldRenderer(String(column.key), tableData.meta, forceLink);
    return fieldRenderer(dataRow, {organization, location});
  };

  render() {
    const {isLoading, error, tableData} = this.props;
    const {columnOrder, columnSortBy} = this.state;
    const {
      renderModalBodyWithForm,
      renderModalFooter,
    } = renderTableModalEditColumnFactory({
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
