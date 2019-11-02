import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import GridEditable from 'app/components/gridEditable';

import {
  getFieldRenderer,
  getAggregateAlias,
  pushEventViewToLocation,
  explodeField,
} from '../utils';
import EventView, {pickRelevantLocationQueryStrings} from '../eventView';
import SortLink from '../sortLink';
import renderTableModalEditColumnFactory from './tableModalEditColumn';
import {TableColumn, TableData, TableDataRow} from './types';
import {ColumnValueType} from '../eventQueryParams';
import DraggableColumns, {
  DRAGGABLE_COLUMN_CLASSNAME_IDENTIFIER,
} from './draggableColumns';

export type TableViewProps = {
  location: Location;
  organization: Organization;

  isLoading: boolean;
  error: string | null;

  eventView: EventView;
  tableData: TableData | null | undefined;
  tagKeys: null | string[];
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
  _createColumn = (
    nextColumn: TableColumn<keyof TableDataRow>,
    insertAt: number | undefined
  ) => {
    const {location, eventView, organization} = this.props;

    let nextEventView: EventView;

    if (typeof insertAt === 'number') {
      const payload = {
        aggregation: String(nextColumn.aggregation),
        field: String(nextColumn.field),
        fieldname: nextColumn.name,
      };

      // create and insert a column at a specific index
      nextEventView = eventView.withNewColumnAt(payload, insertAt);

      // metrics
      trackAnalyticsEvent({
        eventKey: 'discover_v2.add_column',
        eventName: 'Discoverv2: Add a new column at an index',
        insert_at_index: insertAt,
        organization_id: organization.id,
        ...payload,
      });
    } else {
      const payload = {
        aggregation: String(nextColumn.aggregation),
        field: String(nextColumn.field),
        fieldname: nextColumn.name,
      };

      // create and insert a column at the right end of the table
      nextEventView = eventView.withNewColumn(payload);

      // metrics
      trackAnalyticsEvent({
        eventKey: 'discover_v2.add_column.right_end',
        eventName: 'Discoverv2: Add a new column at the right end of the table',
        organization_id: organization.id,
        ...payload,
      });
    }

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
    const {location, eventView, tableData, organization} = this.props;

    if (!tableData || !tableData.meta) {
      return;
    }

    const payload = {
      aggregation: String(nextColumn.aggregation),
      field: String(nextColumn.field),
      fieldname: nextColumn.name,
    };

    const nextEventView = eventView.withUpdatedColumn(
      columnIndex,
      payload,
      tableData.meta
    );

    if (nextEventView !== eventView) {
      const changed: string[] = [];

      const prevField = explodeField(eventView.fields[columnIndex]);
      const nextField = explodeField(nextEventView.fields[columnIndex]);

      const aggregationChanged = prevField.aggregation !== nextField.aggregation;
      const fieldChanged = prevField.field !== nextField.field;
      const fieldnameChanged = prevField.fieldname !== nextField.fieldname;

      if (aggregationChanged) {
        changed.push('aggregate');
      }

      if (fieldChanged) {
        changed.push('field');
      }

      if (fieldnameChanged) {
        changed.push('fieldname');
      }

      // metrics
      trackAnalyticsEvent({
        eventKey: 'discover_v2.update_column',
        eventName: 'Discoverv2: A column was updated',
        updated_at_index: columnIndex,
        changed,
        organization_id: organization.id,
        ...payload,
      });
    }

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
    const {location, eventView, tableData, organization} = this.props;

    if (!tableData || !tableData.meta) {
      return;
    }

    const prevField = explodeField(eventView.fields[columnIndex]);

    const nextEventView = eventView.withDeletedColumn(columnIndex, tableData.meta);

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.delete_column',
      eventName: 'Discoverv2: A column was deleted',
      deleted_at_index: columnIndex,
      organization_id: organization.id,
      aggregation: prevField.aggregation,
      field: prevField.field,
      fieldname: prevField.fieldname,
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
  _moveColumnCommit = (fromIndex: number, toIndex: number) => {
    const {location, eventView, organization} = this.props;

    const prevField = explodeField(eventView.fields[fromIndex]);
    const nextEventView = eventView.withMovedColumn({fromIndex, toIndex});

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.move_column',
      eventName: 'Discoverv2: A column was moved',
      from_index: fromIndex,
      to_index: toIndex,
      organization_id: organization.id,
      aggregation: prevField.aggregation,
      field: prevField.field,
      fieldname: prevField.fieldname,
    });

    pushEventViewToLocation({
      location,
      nextEventView,
      extraQuery: pickRelevantLocationQueryStrings(location),
    });
  };

  _renderGridHeaderCell = (column: TableColumn<keyof TableDataRow>): React.ReactNode => {
    const {eventView, location, tableData} = this.props;

    if (!tableData || !tableData.meta) {
      return column.name;
    }

    const field = column.eventViewField;

    // establish alignment based on the type
    const alignedTypes: ColumnValueType[] = ['number', 'duration'];
    let align: 'right' | 'left' = alignedTypes.includes(column.type) ? 'right' : 'left';

    if (column.type === 'never' || column.type === '*') {
      // fallback to align the column based on the table metadata
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

    if (!tableData || !tableData.meta) {
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
    const {eventView} = this.props;
    const columnOrder = eventView.getColumns();

    if (
      typeof destinationColumnIndex !== 'number' ||
      typeof initialColumnIndex !== 'number'
    ) {
      return columnOrder;
    }

    if (destinationColumnIndex === initialColumnIndex) {
      const currentDraggingColumn: TableColumn<keyof TableDataRow> = {
        ...columnOrder[destinationColumnIndex],
        isDragging: true,
      };

      columnOrder[destinationColumnIndex] = currentDraggingColumn;

      return columnOrder;
    }

    const nextColumnOrder = [...columnOrder];

    nextColumnOrder.splice(
      destinationColumnIndex,
      0,
      nextColumnOrder.splice(initialColumnIndex, 1)[0]
    );

    const currentDraggingColumn: TableColumn<keyof TableDataRow> = {
      ...nextColumnOrder[destinationColumnIndex],
      isDragging: true,
    };
    nextColumnOrder[destinationColumnIndex] = currentDraggingColumn;

    return nextColumnOrder;
  };

  onToggleEdit = (isEditing: boolean) => {
    const {organization} = this.props;

    if (isEditing) {
      // metrics
      trackAnalyticsEvent({
        eventKey: 'discover_v2.table.column_header.edit_mode.enter',
        eventName: 'Discoverv2: Enter column header edit mode',
        organization_id: organization.id,
      });
    } else {
      // metrics
      trackAnalyticsEvent({
        eventKey: 'discover_v2.table.column_header.edit_mode.exit',
        eventName: 'Discoverv2: Exit column header edit mode',
        organization_id: organization.id,
      });
    }
  };

  render() {
    const {organization, isLoading, error, tableData, tagKeys, eventView} = this.props;

    const columnOrder = eventView.getColumns();
    const columnSortBy = eventView.getSorts();

    const {
      renderModalBodyWithForm,
      renderModalFooter,
    } = renderTableModalEditColumnFactory(organization, tagKeys, {
      createColumn: this._createColumn,
      updateColumn: this._updateColumn,
    });

    return (
      <DraggableColumns
        columnOrder={columnOrder}
        onDragDone={({draggingColumnIndex, destinationColumnIndex}) => {
          if (
            typeof draggingColumnIndex === 'number' &&
            typeof destinationColumnIndex === 'number' &&
            draggingColumnIndex !== destinationColumnIndex
          ) {
            this._moveColumnCommit(draggingColumnIndex, destinationColumnIndex);
          }
        }}
      >
        {({
          isColumnDragging,
          startColumnDrag,
          draggingColumnIndex,
          destinationColumnIndex,
        }) => {
          return (
            <GridEditable
              isEditable
              onToggleEdit={this.onToggleEdit}
              isColumnDragging={isColumnDragging}
              gridHeadCellButtonProps={{className: DRAGGABLE_COLUMN_CLASSNAME_IDENTIFIER}}
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
