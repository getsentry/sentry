import React from 'react';

import {t} from 'app/locale';
import {openModal} from 'app/actionCreators/modal';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import InlineSvg from 'app/components/inlineSvg';
import LoadingContainer from 'app/components/loading/loadingContainer';

import {
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
  ObjectKey,
} from './types';
import GridHeadCell from './gridHeadCell';
import GridModalEditColumn from './gridModalEditColumn';
import {
  Header,
  HeaderTitle,
  HeaderButton,
  Body,
  Grid,
  GridRow,
  GridHead,
  GridBody,
  GridBodyCell,
  GridBodyCellSpan,
  GridBodyCellLoading,
  GridBodyErrorAlert,
  GridResizer,
} from './styles';
import {
  COL_WIDTH_MIN,
  COL_WIDTH_DEFAULT,
  COL_WIDTH_NUMBER,
  COL_WIDTH_STRING,
  COL_WIDTH_STRING_LONG,
  ColResizeMetadata,
} from './utils';

type GridEditableProps<DataRow, ColumnKey> = {
  onToggleEdit?: (nextValue: boolean) => void;

  gridHeadCellButtonProps?: {[prop: string]: any};

  isEditable?: boolean;
  isLoading?: boolean;
  isColumnDragging: boolean;
  error?: React.ReactNode | null;

  /**
   * GridEditable (mostly) do not maintain any internal state and relies on the
   * parent component to tell it how/what to render and will mutate the view
   * based on this 3 main props.
   *
   * - `columnOrder` determines the columns to show, from left to right
   * - `columnSortBy` is not used at the moment, however it might be better to
   *   move sorting into Grid for performance
   */
  title?: string;
  columnOrder: GridColumnOrder<ColumnKey>[];
  columnSortBy: GridColumnSortBy<ColumnKey>[];
  data: DataRow[];

  /**
   * GridEditable allows the parent component to determine how to display the
   * data within it. Note that this is optional.
   */
  grid: {
    renderHeadCell?: (
      column: GridColumnOrder<ColumnKey>,
      columnIndex: number
    ) => React.ReactNode;
    renderBodyCell?: (
      column: GridColumnOrder<ColumnKey>,
      dataRow: DataRow
    ) => React.ReactNode;
    onResizeColumn?: (
      columnIndex: number,
      nextColumn: GridColumnOrder<ColumnKey>
    ) => void;
  };

  /**
   * As GridEditable is unopinionated about the structure of GridColumn,
   * ModalEditColumn relies on the parent component to provide the form layout
   * and logic to create/update the columns
   */
  modalEditColumn: {
    renderBodyWithForm: (
      indexColumnOrder?: number,
      column?: GridColumn<ColumnKey>,
      onSubmit?: (column: GridColumn<ColumnKey>) => void,
      onSuccess?: () => void,
      onError?: () => void
    ) => React.ReactNode;
    renderFooter: () => React.ReactNode;
  };

  /**
   * As there is no internal state being maintained, the parent component will
   * have to provide functions to update the state of the columns, especially
   * after moving/resizing
   */
  actions: {
    moveColumnCommit: (indexFrom: number, indexTo: number) => void;
    onDragStart: (
      event: React.MouseEvent<SVGSVGElement, MouseEvent>,
      indexFrom: number
    ) => void;
    deleteColumn: (index: number) => void;
  };
};

type GridEditableState = {
  isEditing: boolean;
  numColumn: number;
};

class GridEditable<
  DataRow extends {[key: string]: any},
  ColumnKey extends ObjectKey
> extends React.Component<GridEditableProps<DataRow, ColumnKey>, GridEditableState> {
  static defaultProps = {
    isEditable: false,
  };

  // Static methods do not allow the use of generics bounded to the parent class
  // For more info: https://github.com/microsoft/TypeScript/issues/14600
  static getDerivedStateFromProps(
    props: GridEditableProps<Object, keyof Object>,
    prevState: GridEditableState
  ): GridEditableState {
    return {
      ...prevState,
      numColumn: props.columnOrder.length,
    };
  }

  state = {
    numColumn: 0,
    isEditing: false,
  };

  componentDidUpdate() {
    // Redraw columns whenever new props are recieved
    this.setGridTemplateColumns(this.props.columnOrder);
  }

  componentWillUnmount() {
    this.clearWindowLifecycleEvents();
  }

  private refGrid = React.createRef<HTMLTableElement>();
  private resizeMetadata?: ColResizeMetadata;
  private resizeWindowLifecycleEvents: {
    [eventName: string]: any[];
  } = {
    mousemove: [],
    mouseup: [],
  };

  clearWindowLifecycleEvents = () => {
    Object.keys(this.resizeWindowLifecycleEvents).forEach(e => {
      this.resizeWindowLifecycleEvents[e].forEach(c => window.removeEventListener(e, c));
      this.resizeWindowLifecycleEvents[e] = [];
    });
  };

  onResizeMouseDown = (e: React.MouseEvent, i: number = -1) => {
    e.preventDefault();

    // Block right-click and other funky stuff
    if (i === -1 || e.type === 'contextmenu') {
      return;
    }

    // <GridResizer> is nested 2 levels down from <GridHeadCell>
    const cell = e.currentTarget!.parentElement!.parentElement;
    if (!cell) {
      return;
    }

    // HACK: Do not put into state to prevent re-rendering of component
    this.resizeMetadata = {
      columnIndex: i,
      columnWidth: cell.offsetWidth,
      cursorX: e.clientX,
    };

    window.addEventListener('mousemove', this.onResizeMouseMove);
    this.resizeWindowLifecycleEvents.mousemove.push(this.onResizeMouseMove);

    window.addEventListener('mouseup', this.onResizeMouseUp);
    this.resizeWindowLifecycleEvents.mouseup.push(this.onResizeMouseUp);
  };

  onResizeMouseUp = (e: MouseEvent) => {
    const metadata = this.resizeMetadata;
    const onResizeColumn = this.props.grid.onResizeColumn;
    if (!metadata || !onResizeColumn) {
      return;
    }

    const {columnOrder} = this.props;
    const widthChange = e.clientX - metadata.cursorX;

    onResizeColumn(metadata.columnIndex, {
      ...columnOrder[metadata.columnIndex],
      width: metadata.columnWidth + widthChange,
    });

    this.resizeMetadata = undefined;
    this.clearWindowLifecycleEvents();
  };

  onResizeMouseMove = (e: MouseEvent) => {
    const {resizeMetadata} = this;
    if (!resizeMetadata) {
      return;
    }

    window.requestAnimationFrame(() => this.resizeGridColumn(e, resizeMetadata));
  };

  toggleEdit = () => {
    const nextValue = !this.state.isEditing;

    if (this.props.onToggleEdit) {
      this.props.onToggleEdit(nextValue);
    }

    this.setState({isEditing: nextValue});
  };

  /**
   * Leave `insertIndex` as undefined to add new column to the end.
   */
  openModalAddColumnAt = (insertIndex: number = -1) => {
    if (insertIndex < 0) {
      insertIndex = this.props.columnOrder.length;
    }

    return this.toggleModalEditColumn(insertIndex);
  };

  toggleModalEditColumn = (
    indexColumnOrder?: number,
    column?: GridColumn<ColumnKey>
  ): void => {
    const {modalEditColumn} = this.props;

    openModal(openModalProps => (
      <GridModalEditColumn
        {...openModalProps}
        indexColumnOrder={indexColumnOrder}
        column={column}
        renderBodyWithForm={modalEditColumn.renderBodyWithForm}
        renderFooter={modalEditColumn.renderFooter}
      />
    ));
  };

  resizeGridColumn = (e: MouseEvent, metadata: ColResizeMetadata) => {
    const grid = this.refGrid.current;
    if (!grid) {
      return;
    }

    const widthChange = e.clientX - metadata.cursorX;

    const nextColumnOrder = [...this.props.columnOrder];
    nextColumnOrder[metadata.columnIndex] = {
      ...nextColumnOrder[metadata.columnIndex],
      width: metadata.columnWidth + widthChange,
    };

    this.setGridTemplateColumns(
      this.props.columnOrder,
      metadata.columnIndex,
      metadata.columnWidth + e.clientX - metadata.cursorX
    );
  };

  /**
   * Set the CSS for Grid Column
   */
  setGridTemplateColumns(
    columnOrder: GridColumnOrder[],
    columnIndex: number = -1,
    columnWidth: number = 0
  ) {
    const grid = this.refGrid.current;
    if (!grid) {
      return;
    }

    const columnWidths = columnOrder.map((c, i) => {
      const width = i !== columnIndex ? c.width : columnWidth;
      return `${Math.max(COL_WIDTH_MIN, Number(width) || COL_WIDTH_DEFAULT)}px`;
    });

    grid.style.gridTemplateColumns = columnWidths.join(' ');
  }

  renderHeaderButton = () => {
    if (!this.props.isEditable) {
      return null;
    }

    return (
      <HeaderButton
        onClick={() => this.openModalAddColumnAt()}
        data-test-id="grid-add-column"
      >
        <InlineSvg src="icon-circle-add" />
        {t('Add Column')}
      </HeaderButton>
    );
  };

  renderGridHeadEditButtons = () => {
    if (!this.props.isEditable) {
      return null;
    }

    if (!this.state.isEditing) {
      return (
        <HeaderButton onClick={this.toggleEdit} data-test-id="grid-edit-enable">
          <InlineSvg src="icon-edit-pencil" />
          {t('Edit Columns')}
        </HeaderButton>
      );
    }

    return (
      <HeaderButton onClick={this.toggleEdit} data-test-id="grid-edit-disable">
        <InlineSvg src="icon-circle-check" />
        {t('Save & Close')}
      </HeaderButton>
    );
  };

  renderGridHead = () => {
    const {error, isLoading, columnOrder, actions, grid, data} = this.props;
    const {isEditing} = this.state;

    // Ensure that the last column cannot be removed
    const numColumn = columnOrder.length;
    const enableEdit = isEditing && numColumn > 1;

    return (
      <GridRow>
        {/* Note that this.onResizeMouseDown assumes GridResizer is nested
            2 levels under GridHeadCell */
        columnOrder.map((column, i) => (
          <GridHeadCell
            openModalAddColumnAt={this.openModalAddColumnAt}
            isLast={columnOrder.length - 1 === i}
            key={`${i}.${column.key}`}
            isColumnDragging={this.props.isColumnDragging}
            isPrimary={column.isPrimary}
            isEditing={enableEdit}
            indexColumnOrder={i}
            column={column}
            gridHeadCellButtonProps={this.props.gridHeadCellButtonProps || {}}
            actions={{
              moveColumnCommit: actions.moveColumnCommit,
              onDragStart: actions.onDragStart,
              deleteColumn: actions.deleteColumn,
              toggleModalEditColumn: this.toggleModalEditColumn,
            }}
          >
            {grid.renderHeadCell ? grid.renderHeadCell(column, i) : column.name}
            <GridResizer
              isLast={i === numColumn - 1}
              dataRows={!error && !isLoading && data ? data.length : 0}
              onMouseDown={e => this.onResizeMouseDown(e, i)}
              onContextMenu={this.onResizeMouseDown}
            />
          </GridHeadCell>
        ))}
      </GridRow>
    );
  };

  renderGridBody = () => {
    const {data, error, isLoading} = this.props;

    if (error) {
      return this.renderError();
    }

    if (isLoading) {
      return this.renderLoading();
    }

    if (!data || data.length === 0) {
      return this.renderEmptyData();
    }

    return data.map(this.renderGridBodyRow);
  };

  renderGridBodyRow = (dataRow: DataRow, row: number) => {
    const {columnOrder, grid} = this.props;

    return (
      <GridRow key={row}>
        {columnOrder.map((col, i) => (
          <GridBodyCell key={`${col.key}${i}`}>
            {grid.renderBodyCell ? grid.renderBodyCell(col, dataRow) : dataRow[col.key]}
          </GridBodyCell>
        ))}
      </GridRow>
    );
  };

  renderError = () => {
    const {error} = this.props;

    return (
      <GridRow>
        <GridBodyCellSpan>
          <GridBodyErrorAlert type="error" icon="icon-circle-exclamation">
            {error}
          </GridBodyErrorAlert>
        </GridBodyCellSpan>
      </GridRow>
    );
  };

  renderLoading = () => {
    return (
      <GridRow>
        <GridBodyCellSpan>
          <GridBodyCellLoading>
            <LoadingContainer isLoading />
          </GridBodyCellLoading>
        </GridBodyCellSpan>
      </GridRow>
    );
  };

  renderEmptyData = () => {
    return (
      <GridRow>
        <GridBodyCellSpan>
          <EmptyStateWarning>
            <p>{t('No results found')}</p>
          </EmptyStateWarning>
        </GridBodyCellSpan>
      </GridRow>
    );
  };

  render() {
    const {title, isEditable} = this.props;

    return (
      <React.Fragment>
        <Header>
          {/* TODO(leedongwei): Check with Bowen/Dora on what they want the
          default title to be */}
          <HeaderTitle>{title || t('Query Builder')}</HeaderTitle>

          {/* TODO(leedongwei): This is ugly but I need to move it to work on
          resizing columns. It will be refactored in a upcoming PR */}
          <div style={{display: 'flex', flexDirection: 'row'}}>
            {this.renderHeaderButton()}

            <div style={{marginLeft: '16px'}}>
              {isEditable && this.renderGridHeadEditButtons()}
            </div>
          </div>
        </Header>

        <Body>
          <Grid innerRef={this.refGrid}>
            <GridHead>{this.renderGridHead()}</GridHead>
            <GridBody>{this.renderGridBody()}</GridBody>
          </Grid>
        </Body>
      </React.Fragment>
    );
  }
}

export default GridEditable;
export {
  COL_WIDTH_MIN,
  COL_WIDTH_DEFAULT,
  COL_WIDTH_NUMBER,
  COL_WIDTH_STRING,
  COL_WIDTH_STRING_LONG,
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
  GridModalEditColumn,
};
