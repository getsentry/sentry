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
  title?: string;
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
    const {columnOrder, actions, grid} = this.props;
    const {isEditing} = this.state;

    // Ensure that the last column cannot be removed
    const enableEdit = isEditing && columnOrder.length > 1;

    return (
      <GridRow>
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
          <Grid
            isEditable={this.props.isEditable}
            isEditing={this.state.isEditing}
            numColumn={this.state.numColumn}
          >
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
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
  GridModalEditColumn,
};
