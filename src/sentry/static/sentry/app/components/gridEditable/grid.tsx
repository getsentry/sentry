import React from 'react';

import {t} from 'app/locale';
import {openModal} from 'app/actionCreators/modal';

import Alert from 'app/components/alert';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import InlineSvg from 'app/components/inlineSvg';
import LoadingContainer from 'app/components/loading/loadingContainer';
import {Panel, PanelBody} from 'app/components/panels';
import ToolTip from 'app/components/tooltip';

import {GridColumnOrder, GridColumnSortBy} from './gridTypes';
import GridHeadCell from './gridHeadCell';
import GridBodyCell from './gridBodyCell';
import GridModalEditColumn from './gridModalEditColumn';
import {
  Grid,
  GridRow,
  GridHead,
  GridBody,
  GridEditGroup,
  GridEditGroupButton,
} from './styles';

export type GridEditableProps<DataRow, ColumnKey extends keyof DataRow> = {
  isEditable?: boolean;
  isLoading?: boolean;
  error?: React.ReactNode | null;

  data: DataRow[];
  columnOrder: GridColumnOrder<ColumnKey>[];
  columnSortBy: GridColumnSortBy<ColumnKey>[];

  grid: {
    renderHeaderCell: {(column: GridColumnOrder<ColumnKey>): React.ReactNode};
    renderBodyCell: {
      (column: GridColumnOrder<ColumnKey>, dataRow: DataRow): React.ReactNode;
    };
  };

  /**
   * Inner components of the ModalEditColumn. The ModalEditColumn is unopinionated about the
   */
  modalEditColumn: {
    /**
     * This function requires the end-user to wire up the create/update/delete
     * functions and success/error callbacks for the Modal to edit Column
     */
    renderBodyWithForm: {(column: any): React.ReactNode};
    renderFooter: {(): React.ReactNode};
  };
  actions: {
    addColumn: {(index: number, column: GridColumnOrder<ColumnKey>): void};
    updateColumn: {(index: number, column: GridColumnOrder<ColumnKey>): void};
    deleteColumn: {(index: number): void};
    moveColumn: {(fromIndex: number, toIndex: number): void};
  };
};
export type GridEditableState = {
  isEditing: boolean;
  numColumn: number;
};

/**
 * Generic type <T> is an object that contains data for 1 row of the table,
 * where the keys are the columns and the values are the data
 */
class GridEditable<DataRow extends Object> extends React.Component<
  GridEditableProps<DataRow, keyof DataRow>,
  GridEditableState
> {
  static defaultProps = {
    isEditable: false,

    actions: {
      createColumn: () => {},
      patchColumn: () => {},
      deleteColumn: () => {},
      moveColumn: () => {},
      onActionSuccess: () => {},
      onActionError: () => {},
    },
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
    this.setState({isEditing: !this.state.isEditing});
  };

  toggleModalEditColumn = () => {
    if (this.state.isEditing) {
      const {modalEditColumn} = this.props;

      openModal(openModalProps => (
        <GridModalEditColumn
          {...openModalProps}
          renderBody={modalEditColumn.renderBodyWithForm}
          renderFooter={modalEditColumn.renderFooter}
        />
      ));
    }
  };

  renderError = () => {
    const {error: errorMessage} = this.props;

    return (
      <>
        <Alert type="error" icon="icon-circle-exclamation">
          {errorMessage}
        </Alert>
        <Panel>
          <Grid numColumn={this.state.numColumn}>{this.renderGridHead()}</Grid>
        </Panel>
      </>
    );
  };

  renderLoading = () => {
    return (
      <GridBody>
        <div style={{minHeight: '240px', gridColumn: '1 / -1'}}>
          <LoadingContainer isLoading={true} />
        </div>
      </GridBody>
    );
  };

  renderEmptyData = () => {
    return (
      <GridBody>
        <div style={{minHeight: '200px', gridColumn: '1 / -1'}}>
          <EmptyStateWarning>
            <p>{t('No results found')}</p>
          </EmptyStateWarning>
        </div>
      </GridBody>
    );
  };

  renderGridHead = () => {
    const {isEditable, columnOrder, actions, grid} = this.props;
    const {isEditing} = this.state;

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

          {columnOrder.map((column, i) => (
            <GridHeadCell
              key={`${column.key}${i}`}
              isPrimary={column.isPrimary}
              isEditing={isEditing}
              actions={{
                addColumn: (col: GridColumnOrder<keyof DataRow>) =>
                  actions.addColumn(i, col),
                updateColumn: (col: GridColumnOrder<keyof DataRow>) =>
                  actions.updateColumn(i, col),
                deleteColumn: () => actions.deleteColumn(i),
                toggleModalEditColumn: this.toggleModalEditColumn,
              }}
            >
              {grid.renderHeaderCell(column)}
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
          <GridEditGroupButton onClick={this.toggleEdit}>
            <ToolTip title={t('Edit Columns')}>
              <InlineSvg src="icon-edit-2" />
            </ToolTip>
          </GridEditGroupButton>
        </GridEditGroup>
      );
    }

    return (
      <GridEditGroup>
        <GridEditGroupButton onClick={this.toggleModalEditColumn}>
          <ToolTip title={t('Add Columns')}>
            <InlineSvg src="icon-circle-add" />
          </ToolTip>
        </GridEditGroupButton>
        <GridEditGroupButton onClick={this.toggleEdit}>
          <ToolTip title={t('Cancel Edit')}>
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
    return (
      <GridRow key={row}>
        {this.props.columnOrder.map((col, i) => (
          <GridBodyCell key={`${col.name}${i}`}>
            {this.props.grid.renderBodyCell(col, dataRow)}
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
      <Panel>
        <PanelBody style={{minHeight: '240px'}}>
          <Grid
            isEditable={this.props.isEditable}
            isEditing={this.state.isEditing}
            numColumn={this.state.numColumn}
          >
            {this.renderGridHead()}
            {this.props.isLoading ? this.renderLoading() : this.renderGridBody()}
          </Grid>
        </PanelBody>
      </Panel>
    );
  }
}

export default GridEditable;
