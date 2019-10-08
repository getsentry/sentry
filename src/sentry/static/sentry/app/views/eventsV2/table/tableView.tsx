import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';

import GridEditable from 'app/components/gridEditable';

import {getFieldRenderer, getAggregateAlias, pushEventViewToLocation} from '../utils';
import EventView, {pickRelevantLocationQueryStrings} from '../eventView';
import SortLink from '../sortLink';
import renderTableModalEditColumnFactory from './tableModalEditColumn';
import {TableColumn, TableData, TableDataRow} from './types';
import {ColumnValueType} from '../eventQueryParams';
import DraggableColumns from './draggableColumns';

export type TableViewProps = {
  location: Location;
  organization: Organization;

  isLoading: boolean;
  error: string | null;

  eventView: EventView;
  tableData: TableData | null | undefined;
};

/**
 *
 * The `TableView` is marked with leading _ in its method names. It consumes
 * the EventView object given in its props to generate new EventView objects
 * for actions such as creating new columns, updating columns, sorting columns,
 * and re-ordering columns.
 */
class TableView extends React.Component<TableViewProps> {
  /**
   * The entire state of the table view (or event view) is co-located within
   * the EventView object. This object is fed from the props.
   *
   * Attempting to modify the state, and therefore, modifying the given EventView
   * object given from its props, will generate new instances of EventView objects.
   *
   * In most cases, the new EventView object differs from the previous EventView
   * object. The new EventView object is pushed to the location object.
   */
  _createColumn = (nextColumn: TableColumn<keyof TableDataRow>) => {
    const {location, eventView} = this.props;

    const nextEventView = eventView.withNewColumn({
      aggregation: String(nextColumn.aggregation),
      field: String(nextColumn.field),
      fieldname: nextColumn.name,
    });

    pushEventViewToLocation({
      location,
      nextEventView,
      extraQuery: pickRelevantLocationQueryStrings(location),
    });
  };

  /**
   * Please read the comment on `_createColumn`
   */
  _updateColumn = (columnIndex: number, nextColumn: TableColumn<keyof TableDataRow>) => {
    const {location, eventView, tableData} = this.props;

    if (!tableData) {
      return;
    }

    const nextEventView = eventView.withUpdatedColumn(
      columnIndex,
      {
        aggregation: String(nextColumn.aggregation),
        field: String(nextColumn.field),
        fieldname: nextColumn.name,
      },
      tableData.meta
    );

    pushEventViewToLocation({
      location,
      nextEventView,
      extraQuery: pickRelevantLocationQueryStrings(location),
    });
  };

  /**
   * Please read the comment on `_createColumn`
   */
  _deleteColumn = (columnIndex: number) => {
    const {location, eventView, tableData} = this.props;

    if (!tableData) {
      return;
    }

    const nextEventView = eventView.withDeletedColumn(columnIndex, tableData.meta);

    pushEventViewToLocation({
      location,
      nextEventView,
      extraQuery: pickRelevantLocationQueryStrings(location),
    });
  };

  /**
   * Please read the comment on `_createColumn`
   */
  _moveColumnCommit = (fromIndex: number, toIndex: number) => {
    const {location, eventView} = this.props;

    const nextEventView = eventView.withMovedColumn({fromIndex, toIndex});

    pushEventViewToLocation({
      location,
      nextEventView,
      extraQuery: pickRelevantLocationQueryStrings(location),
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

  generateColumnOrder = ({
    initialColumnIndex,
    destinationColumnIndex,
  }: {
    initialColumnIndex: undefined | number;
    destinationColumnIndex: undefined | number;
  }) => {
    if (
      typeof destinationColumnIndex !== 'number' ||
      typeof initialColumnIndex !== 'number'
    ) {
      return this.state.columnOrder;
    }

    const nextColumnOrder = [...this.state.columnOrder];

    nextColumnOrder.splice(
      destinationColumnIndex,
      0,
      nextColumnOrder.splice(initialColumnIndex, 1)[0]
    );

    return nextColumnOrder;
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
      <DraggableColumns columnOrder={this.state.columnOrder}>
        {({startColumnDrag, draggingColumnIndex, destinationColumnIndex}) => {
          return (
            <GridEditable
              isEditable
              isLoading={isLoading}
              error={error}
              data={tableData ? tableData.data : []}
              columnOrder={this.generateColumnOrder({
                initialColumnIndex: draggingColumnIndex,
                destinationColumnIndex,
              })}
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
                moveColumnCommit: this._moveColumnCommit,
                onDragStart: startColumnDrag,
              }}
            />
          );
        }}
      </DraggableColumns>
    );
  }
}

export default TableView;
