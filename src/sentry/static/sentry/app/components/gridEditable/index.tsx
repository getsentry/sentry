import React from 'react';

import {t} from 'app/locale';
import {openModal} from 'app/actionCreators/modal';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Hovercard from 'app/components/hovercard';
import InlineSvg from 'app/components/inlineSvg';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconAdd, IconEdit, IconWarning} from 'app/icons';
import theme from 'app/utils/theme';

import {
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
  ObjectKey,
} from './types';
import {
  Header,
  HeaderTitle,
  HeaderButton,
  HeaderButtonContainer,
  Body,
  Grid,
  GridRow,
  GridHead,
  GridHeadCellStatic,
  GridBody,
  GridBodyCell,
  GridBodyCellStatus,
  GridResizer,
} from './styles';
import GridHeadCell from './gridHeadCell';
import GridModalEditColumn from './gridModalEditColumn';

import {COL_WIDTH_MINIMUM, COL_WIDTH_UNDEFINED, ColResizeMetadata} from './utils';

type GridEditableProps<DataRow, ColumnKey> = {
  onToggleEdit?: (nextValue: boolean) => void;

  gridHeadCellButtonProps?: {[prop: string]: any};
  /**
   * This is currently required as we only have one usage of
   * this component in the future. If we have more this could be
   * made optional. You will need to update renderHeaderButtons() though.
   */
  editFeatures: string[];
  noEditMessage?: string;

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
    renderPrependColumns?: (
      isHeader: boolean,
      dataRow?: any,
      rowIndex?: number
    ) => React.ReactNode[];
    prependColumnWidths?: string[];
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
    downloadAsCsv: () => void;
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

  componentDidMount() {
    window.addEventListener('resize', this.redrawGridColumn);
    this.setGridTemplateColumns(this.props.columnOrder);
  }

  componentDidUpdate() {
    // Redraw columns whenever new props are recieved
    this.setGridTemplateColumns(this.props.columnOrder);
  }

  componentWillUnmount() {
    this.clearWindowLifecycleEvents();
    window.removeEventListener('resize', this.redrawGridColumn);
  }

  private refGrid = React.createRef<HTMLTableElement>();
  private resizeMetadata?: ColResizeMetadata;
  private resizeWindowLifecycleEvents: {
    [eventName: string]: any[];
  } = {
    mousemove: [],
    mouseup: [],
  };

  clearWindowLifecycleEvents() {
    Object.keys(this.resizeWindowLifecycleEvents).forEach(e => {
      this.resizeWindowLifecycleEvents[e].forEach(c => window.removeEventListener(e, c));
      this.resizeWindowLifecycleEvents[e] = [];
    });
  }

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

  handleToggleEdit = () => {
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

  resizeGridColumn(e: MouseEvent, metadata: ColResizeMetadata) {
    const grid = this.refGrid.current;
    if (!grid) {
      return;
    }

    const widthChange = e.clientX - metadata.cursorX;

    const nextColumnOrder = [...this.props.columnOrder];
    nextColumnOrder[metadata.columnIndex] = {
      ...nextColumnOrder[metadata.columnIndex],
      width: Math.max(metadata.columnWidth + widthChange, 0),
    };

    this.setGridTemplateColumns(nextColumnOrder);
  }

  /**
   * Recalculate the dimensions of Grid and Columns and redraws them
   */
  redrawGridColumn = () => {
    this.setGridTemplateColumns(this.props.columnOrder);
  };

  /**
   * Set the CSS for Grid Column
   */
  setGridTemplateColumns(columnOrder: GridColumnOrder[]) {
    const grid = this.refGrid.current;
    if (!grid) {
      return;
    }
    const prependColumns = this.props.grid.prependColumnWidths || [];
    const prepend = prependColumns.join(' ');
    const widths = columnOrder.map(item => {
      if (item.width === COL_WIDTH_UNDEFINED) {
        return `minmax(${COL_WIDTH_MINIMUM}px, auto)`;
      }
      if (typeof item.width === 'number' && item.width > COL_WIDTH_MINIMUM) {
        return `${item.width}px`;
      }
      return `${COL_WIDTH_MINIMUM}px`;
    });

    grid.style.gridTemplateColumns = `${prepend} ${widths.join(' ')}`;
  }

  renderHeaderButtons() {
    const {noEditMessage, editFeatures} = this.props;
    const renderDisabled = p => (
      <Hovercard
        body={
          <FeatureDisabled
            features={p.features}
            hideHelpToggle
            message={noEditMessage}
            featureName={noEditMessage}
          />
        }
      >
        {p.children(p)}
      </Hovercard>
    );

    return (
      <Feature
        hookName="feature-disabled:grid-editable-actions"
        renderDisabled={renderDisabled}
        features={editFeatures}
      >
        {({hasFeature}) => (
          <React.Fragment>
            {this.renderDownloadCsvButton(hasFeature)}
            {this.renderAddColumnButton(hasFeature)}
            {this.renderEditButtons(hasFeature)}
          </React.Fragment>
        )}
      </Feature>
    );
  }

  renderAddColumnButton(canEdit: boolean) {
    const onClick = canEdit ? () => this.openModalAddColumnAt() : undefined;
    return (
      <HeaderButton disabled={!canEdit} onClick={onClick} data-test-id="grid-add-column">
        <IconAdd size="xs" circle />
        &nbsp;{t('Add Column')}
      </HeaderButton>
    );
  }

  renderDownloadCsvButton(canEdit: boolean) {
    const disabled = this.props.isLoading || canEdit === false;
    const onClick = disabled ? undefined : this.props.actions.downloadAsCsv;

    return (
      <HeaderButton
        disabled={disabled}
        onClick={onClick}
        data-test-id="grid-download-csv"
      >
        <InlineSvg src="icon-download" />
        {t('Download CSV')}
      </HeaderButton>
    );
  }

  renderEditButtons(canEdit: boolean) {
    const onClick = canEdit ? this.handleToggleEdit : undefined;
    if (!this.state.isEditing) {
      return (
        <HeaderButton
          disabled={!canEdit}
          onClick={onClick}
          data-test-id="grid-edit-enable"
        >
          <IconEdit size="xs" />
          {t('Edit Columns')}
        </HeaderButton>
      );
    }

    return (
      <HeaderButton onClick={onClick} data-test-id="grid-edit-disable">
        <InlineSvg src="icon-circle-check" />
        {t('Save & Close')}
      </HeaderButton>
    );
  }

  renderGridHead() {
    const {error, isLoading, columnOrder, actions, grid, data} = this.props;
    const {isEditing} = this.state;

    // Ensure that the last column cannot be removed
    const numColumn = columnOrder.length;

    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(true)
      : [];
    return (
      <GridRow>
        {prependColumns &&
          prependColumns.map((item, i) => {
            return <GridHeadCellStatic key={`prepend-${i}`}>{item}</GridHeadCellStatic>;
          })}
        {/* Note that this.onResizeMouseDown assumes GridResizer is nested
            2 levels under GridHeadCell */
        columnOrder.map((column, i) => (
          <GridHeadCell
            openModalAddColumnAt={this.openModalAddColumnAt}
            isFirst={i === 0}
            key={`${i}.${column.key}`}
            isColumnDragging={this.props.isColumnDragging}
            isEditing={isEditing}
            isDeletable={numColumn > 1}
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
  }

  renderGridBody() {
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
  }

  renderGridBodyRow = (dataRow: DataRow, row: number) => {
    const {columnOrder, grid} = this.props;
    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(false, dataRow, row)
      : [];

    return (
      <GridRow key={row}>
        {prependColumns &&
          prependColumns.map((item, i) => {
            return <GridBodyCell key={`prepend-${i}`}>{item}</GridBodyCell>;
          })}
        {columnOrder.map((col, i) => (
          <GridBodyCell key={`${col.key}${i}`}>
            {grid.renderBodyCell ? grid.renderBodyCell(col, dataRow) : dataRow[col.key]}
          </GridBodyCell>
        ))}
      </GridRow>
    );
  };

  renderError() {
    return (
      <GridRow>
        <GridBodyCellStatus>
          <IconWarning color={theme.gray2} size="lg" />
        </GridBodyCellStatus>
      </GridRow>
    );
  }

  renderLoading() {
    return (
      <GridRow>
        <GridBodyCellStatus>
          <LoadingIndicator />
        </GridBodyCellStatus>
      </GridRow>
    );
  }

  renderEmptyData() {
    return (
      <GridRow>
        <GridBodyCellStatus>
          <EmptyStateWarning>
            <p>{t('No results found')}</p>
          </EmptyStateWarning>
        </GridBodyCellStatus>
      </GridRow>
    );
  }

  render() {
    return (
      <React.Fragment>
        <Header>
          <HeaderTitle>{t('Results')}</HeaderTitle>
          <HeaderButtonContainer>{this.renderHeaderButtons()}</HeaderButtonContainer>
        </Header>

        <Body>
          <Grid ref={this.refGrid}>
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
  COL_WIDTH_UNDEFINED,
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
  GridModalEditColumn,
};
