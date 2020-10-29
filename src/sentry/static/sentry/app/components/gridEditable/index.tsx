import React from 'react';
import {Location} from 'history';

import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconWarning} from 'app/icons';

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
  HeaderButtonContainer,
  Body,
  Grid,
  GridRow,
  GridHead,
  GridHeadCell,
  GridHeadCellStatic,
  GridBody,
  GridBodyCell,
  GridBodyCellStatus,
  GridResizer,
} from './styles';
import {COL_WIDTH_MINIMUM, COL_WIDTH_UNDEFINED, ColResizeMetadata} from './utils';

type GridEditableProps<DataRow, ColumnKey> = {
  location: Location;
  isLoading?: boolean;
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
  /**
   * Inject a set of buttons into the top of the grid table.
   * The controlling component is responsible for handling any actions
   * in these buttons and updating props to the GridEditable instance.
   */
  headerButtons?: () => React.ReactNode;
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
      dataRow: DataRow,
      rowIndex: number,
      columnIndex: number
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
};

type GridEditableState = {
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
  };

  componentDidMount() {
    window.addEventListener('resize', this.redrawGridColumn);
    this.setGridTemplateColumns(this.props.columnOrder);
  }

  componentDidUpdate() {
    // Redraw columns whenever new props are received
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

  onResetColumnSize = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();

    const nextColumnOrder = [...this.props.columnOrder];
    nextColumnOrder[i] = {
      ...nextColumnOrder[i],
      width: COL_WIDTH_UNDEFINED,
    };
    this.setGridTemplateColumns(nextColumnOrder);

    const onResizeColumn = this.props.grid.onResizeColumn;
    if (onResizeColumn) {
      onResizeColumn(i, {
        ...nextColumnOrder[i],
        width: COL_WIDTH_UNDEFINED,
      });
    }
  };

  onResizeMouseDown = (e: React.MouseEvent, i: number = -1) => {
    e.stopPropagation();

    // Block right-click and other funky stuff
    if (i === -1 || e.type === 'contextmenu') {
      return;
    }

    // <GridResizer> is nested 1 level down from <GridHeadCell>
    const cell = e.currentTarget!.parentElement;
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

    // The last column has no resizer and should always be a flexible column
    // to prevent underflows.
    if (widths.length > 0) {
      widths[widths.length - 1] = `minmax(${COL_WIDTH_MINIMUM}px, auto)`;
    }

    grid.style.gridTemplateColumns = `${prepend} ${widths.join(' ')}`;
  }

  renderGridHead() {
    const {error, isLoading, columnOrder, grid, data} = this.props;

    // Ensure that the last column cannot be removed
    const numColumn = columnOrder.length;

    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(true)
      : [];
    return (
      <GridRow>
        {prependColumns &&
          prependColumns.map((item, i) => (
            <GridHeadCellStatic key={`prepend-${i}`}>{item}</GridHeadCellStatic>
          ))}
        {
          /* Note that this.onResizeMouseDown assumes GridResizer is nested
            1 levels under GridHeadCell */
          columnOrder.map((column, i) => (
            <GridHeadCell key={`${i}.${column.key}`} isFirst={i === 0}>
              {grid.renderHeadCell ? grid.renderHeadCell(column, i) : column.name}
              {i !== numColumn - 1 && (
                <GridResizer
                  dataRows={!error && !isLoading && data ? data.length : 0}
                  onMouseDown={e => this.onResizeMouseDown(e, i)}
                  onDoubleClick={e => this.onResetColumnSize(e, i)}
                  onContextMenu={this.onResizeMouseDown}
                />
              )}
            </GridHeadCell>
          ))
        }
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
          prependColumns.map((item, i) => (
            <GridBodyCell key={`prepend-${i}`}>{item}</GridBodyCell>
          ))}
        {columnOrder.map((col, i) => (
          <GridBodyCell key={`${col.key}${i}`}>
            {grid.renderBodyCell
              ? grid.renderBodyCell(col, dataRow, row, i)
              : dataRow[col.key]}
          </GridBodyCell>
        ))}
      </GridRow>
    );
  };

  renderError() {
    return (
      <GridRow>
        <GridBodyCellStatus>
          <IconWarning color="gray500" size="lg" />
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
    const {title, headerButtons} = this.props;
    const showHeader = title || headerButtons;
    return (
      <React.Fragment>
        {showHeader && (
          <Header>
            {title && <HeaderTitle>{title}</HeaderTitle>}
            {headerButtons && (
              <HeaderButtonContainer>{headerButtons()}</HeaderButtonContainer>
            )}
          </Header>
        )}
        <Body>
          <Grid data-test-id="grid-editable" ref={this.refGrid}>
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
  COL_WIDTH_MINIMUM,
  COL_WIDTH_UNDEFINED,
  GridColumn,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
};
