import React from 'react';

import {t} from 'app/locale';
import {openModal} from 'app/actionCreators/modal';

import Alert from 'app/components/alert';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import InlineSvg from 'app/components/inlineSvg';
import LoadingContainer from 'app/components/loading/loadingContainer';
import ToolTip from 'app/components/tooltip';

import {
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
  ObjectKey,
} from './types';
import GridHeadCell from './gridHeadCell';
import GridModalEditColumn from './gridModalEditColumn';
import AddColumnButton from './addColumnButton';
import {
  GridPanel,
  GridPanelBody,
  Grid,
  GridRow,
  GridHead,
  GridBody,
  GridBodyCell,
  GridBodyCellSpan,
  GridBodyCellLoading,
  GridEditGroup,
  GridEditGroupButton,
} from './styles';

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
  columnOrder: GridColumnOrder<ColumnKey>[];
  columnSortBy: GridColumnSortBy<ColumnKey>[];
  data: DataRow[];

  /**
   * GridEditable allows the parent component to determine how to display the
   * data within it. Note that this is optional.
   */
  grid: {
    renderHeaderCell?: (
      column: GridColumnOrder<ColumnKey>,
      columnIndex: number
    ) => React.ReactNode;
    renderBodyCell?: (
      column: GridColumnOrder<ColumnKey>,
      dataRow: DataRow
    ) => React.ReactNode;
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
   * have to provide functions to move/delete the columns
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

  state = {
    numColumn: 0,
    isEditing: false,
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

  toggleEdit = () => {
    const nextValue = !this.state.isEditing;

    if (this.props.onToggleEdit) {
      this.props.onToggleEdit(nextValue);
    }

    this.setState({isEditing: nextValue});
  };

  openModalAddColumnAt = (insertIndex: number) => {
    return this.toggleModalEditColumn(insertIndex);
  };

  toggleModalEditColumn = (
    indexColumnOrder?: number,
    column?: GridColumn<ColumnKey>
  ): void => {
    if (this.state.isEditing) {
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
    }
  };

  renderError = () => {
    const {error} = this.props;

    return (
      <React.Fragment>
        <Alert type="error" icon="icon-circle-exclamation">
          {error}
        </Alert>
        <GridPanel>
          <Grid
            isEditable={this.props.isEditable}
            isEditing={this.state.isEditing}
            numColumn={this.state.numColumn}
          >
            {this.renderGridHead()}
            <GridBody>
              <GridRow>
                <GridBodyCellSpan>{error}</GridBodyCellSpan>
              </GridRow>
            </GridBody>
          </Grid>
        </GridPanel>
      </React.Fragment>
    );
  };

  renderLoading = () => {
    return (
      <GridBody>
        <GridRow>
          <GridBodyCellSpan>
            <GridBodyCellLoading>
              <LoadingContainer isLoading />
            </GridBodyCellLoading>
          </GridBodyCellSpan>
        </GridRow>
      </GridBody>
    );
  };

  renderEmptyData = () => {
    return (
      <GridBody>
        <GridRow>
          <GridBodyCellSpan>
            <EmptyStateWarning>
              <p>{t('No results found')}</p>
            </EmptyStateWarning>
          </GridBodyCellSpan>
        </GridRow>
      </GridBody>
    );
  };

  renderGridHead = () => {
    const {isEditable, columnOrder, actions, grid} = this.props;
    const {isEditing} = this.state;

    // Ensure that the last column cannot be removed
    const enableEdit = isEditing && columnOrder.length > 1;

    return (
      <GridHead>
        <GridRow>
          {/* GridHeadEdit must come first.

              It is a <th> that uses `position: absolute` to set its placement.
              The CSS selectors captures the last GridHeadCell and put a
              padding-right to provide space for GridHeadEdit to be displayed.

              FAQ:
              Instead of using `position: absolute`, why can't we just put
              GridHeadEdit at the end so it appears on the right?
              Because CSS Grids need to have the same number of Head/Body cells
              for everything to align properly. Sub-grids are new and may not be
              well supported in older browsers/

              Why can't we just put GridHeadEdit somewhere else?
              Because HTML rules mandate that <div> cannot be a nested child of
              a <table>. This seems the best way to make it correct to satisfy
              HTML semantics. */
          isEditable && this.renderGridHeadEditButtons()}

          {columnOrder.map((column, columnIndex) => (
            <GridHeadCell
              openModalAddColumnAt={this.openModalAddColumnAt}
              isLast={columnOrder.length - 1 === columnIndex}
              key={`${columnIndex}.${column.key}`}
              isColumnDragging={this.props.isColumnDragging}
              isPrimary={column.isPrimary}
              isEditing={enableEdit}
              indexColumnOrder={columnIndex}
              column={column}
              gridHeadCellButtonProps={this.props.gridHeadCellButtonProps || {}}
              actions={{
                moveColumnCommit: actions.moveColumnCommit,
                onDragStart: actions.onDragStart,
                deleteColumn: actions.deleteColumn,
                toggleModalEditColumn: this.toggleModalEditColumn,
              }}
            >
              {grid.renderHeaderCell
                ? grid.renderHeaderCell(column, columnIndex)
                : column.name}
            </GridHeadCell>
          ))}
        </GridRow>
      </GridHead>
    );
  };

  renderGridHeadEditButtons = () => {
    if (!this.props.isEditable) {
      return null;
    }

    if (!this.state.isEditing) {
      return (
        <GridEditGroup>
          <GridEditGroupButton onClick={this.toggleEdit} data-test-id="grid-edit-enable">
            <ToolTip title={t('Edit Columns')}>
              <InlineSvg src="icon-edit-pencil" />
            </ToolTip>
          </GridEditGroupButton>
        </GridEditGroup>
      );
    }

    return (
      <GridEditGroup>
        <AddColumnButton
          align="left"
          onClick={() => this.toggleModalEditColumn()}
          data-test-id="grid-add-column-right-end"
        />
        <GridEditGroupButton onClick={this.toggleEdit}>
          <ToolTip title={t('Exit Edit')}>
            <InlineSvg src="icon-close" />
          </ToolTip>
        </GridEditGroupButton>
      </GridEditGroup>
    );
  };

  renderGridBody = () => {
    const {data} = this.props;

    if (!data || data.length === 0) {
      return this.renderEmptyData();
    }

    return <GridBody>{data.map(this.renderGridBodyRow)}</GridBody>;
  };

  renderGridBodyRow = (dataRow: DataRow, row: number) => {
    const {grid} = this.props;

    return (
      <GridRow key={row}>
        {this.props.columnOrder.map((col, i) => (
          <GridBodyCell key={`${col.key}${i}`}>
            {grid.renderBodyCell ? grid.renderBodyCell(col, dataRow) : dataRow[col.key]}
          </GridBodyCell>
        ))}
      </GridRow>
    );
  };

  render() {
    if (this.props.error) {
      return this.renderError();
    }

    return (
      <GridPanel>
        <GridPanelBody>
          <Grid
            isEditable={this.props.isEditable}
            isEditing={this.state.isEditing}
            numColumn={this.state.numColumn}
          >
            {this.renderGridHead()}
            {this.props.isLoading ? this.renderLoading() : this.renderGridBody()}
          </Grid>
        </GridPanelBody>
      </GridPanel>
    );
  }
}

export default GridEditable;
export {
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
  GridModalEditColumn,
};
