import {Component, createRef, Fragment, Profiler} from 'react';
import {Location} from 'history';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {onRenderCallback} from 'sentry/utils/performanceForSentry';

import {
  Body,
  Grid,
  GridBody,
  GridBodyCell,
  GridBodyCellStatus,
  GridHead,
  GridHeadCell,
  GridHeadCellStatic,
  GridResizer,
  GridRow,
  Header,
  HeaderButtonContainer,
  HeaderTitle,
} from './styles';

// Auto layout width.
export const COL_WIDTH_UNDEFINED = -1;

// Set to 90 as the edit/trash icons need this much space.
export const COL_WIDTH_MINIMUM = 90;

// For GridEditable, there are 2 generic types for the component, T and K
//
// - T is an element/object that represents the data to be displayed
// - K is a key of T/
//   - columnKey should have the same set of values as K

type ObjectKey = React.ReactText;

export type GridColumn<K = ObjectKey> = {
  key: K;
  width?: number;
};

export type GridColumnHeader<K = ObjectKey> = GridColumn<K> & {
  name: string;
};

export type GridColumnOrder<K = ObjectKey> = GridColumnHeader<K>;

export type GridColumnSortBy<K = ObjectKey> = GridColumn<K> & {
  order: 'desc' | 'asc';
};

/**
 * Store state at the start of "resize" action
 */
export type ColResizeMetadata = {
  columnIndex: number; // Column being resized
  columnWidth: number; // Column width at start of resizing
  cursorX: number; // X-coordinate of cursor on window
};

type GridEditableProps<DataRow, ColumnKey> = {
  columnOrder: GridColumnOrder<ColumnKey>[];
  columnSortBy: GridColumnSortBy<ColumnKey>[];
  data: DataRow[];

  /**
   * GridEditable allows the parent component to determine how to display the
   * data within it. Note that this is optional.
   */
  grid: {
    onResizeColumn?: (
      columnIndex: number,
      nextColumn: GridColumnOrder<ColumnKey>
    ) => void;
    prependColumnWidths?: string[];
    renderBodyCell?: (
      column: GridColumnOrder<ColumnKey>,
      dataRow: DataRow,
      rowIndex: number,
      columnIndex: number
    ) => React.ReactNode;
    renderHeadCell?: (
      column: GridColumnOrder<ColumnKey>,
      columnIndex: number
    ) => React.ReactNode;
    renderPrependColumns?: (
      isHeader: boolean,
      dataRow?: DataRow,
      rowIndex?: number
    ) => React.ReactNode[];
  };
  location: Location;
  error?: React.ReactNode | null;
  /**
   * Inject a set of buttons into the top of the grid table.
   * The controlling component is responsible for handling any actions
   * in these buttons and updating props to the GridEditable instance.
   */
  headerButtons?: () => React.ReactNode;
  height?: string | number;
  isLoading?: boolean;

  scrollable?: boolean;
  stickyHeader?: boolean;

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
};

type GridEditableState = {
  numColumn: number;
};

class GridEditable<
  DataRow extends {[key: string]: any},
  ColumnKey extends ObjectKey
> extends Component<GridEditableProps<DataRow, ColumnKey>, GridEditableState> {
  // Static methods do not allow the use of generics bounded to the parent class
  // For more info: https://github.com/microsoft/TypeScript/issues/14600
  static getDerivedStateFromProps(
    props: Readonly<GridEditableProps<Record<string, any>, ObjectKey>>,
    prevState: GridEditableState
  ): GridEditableState {
    return {
      ...prevState,
      numColumn: props.columnOrder.length,
    };
  }

  state: GridEditableState = {
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

  private refGrid = createRef<HTMLTableElement>();
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

    if (metadata && onResizeColumn) {
      const {columnOrder} = this.props;
      const widthChange = e.clientX - metadata.cursorX;

      onResizeColumn(metadata.columnIndex, {
        ...columnOrder[metadata.columnIndex],
        width: metadata.columnWidth + widthChange,
      });
    }

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
    const widths = columnOrder.map((item, index) => {
      if (item.width === COL_WIDTH_UNDEFINED) {
        return `minmax(${COL_WIDTH_MINIMUM}px, auto)`;
      }
      if (typeof item.width === 'number' && item.width > COL_WIDTH_MINIMUM) {
        if (index === columnOrder.length - 1) {
          return `minmax(${item.width}px, auto)`;
        }
        return `${item.width}px`;
      }
      if (index === columnOrder.length - 1) {
        return `minmax(${COL_WIDTH_MINIMUM}px, auto)`;
      }
      return `${COL_WIDTH_MINIMUM}px`;
    });

    // The last column has no resizer and should always be a flexible column
    // to prevent underflows.

    grid.style.gridTemplateColumns = `${prepend} ${widths.join(' ')}`;
  }

  renderGridHead() {
    const {error, isLoading, columnOrder, grid, data, stickyHeader} = this.props;

    // Ensure that the last column cannot be removed
    const numColumn = columnOrder.length;

    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(true)
      : [];
    return (
      <GridRow data-test-id="grid-head-row">
        {prependColumns &&
          columnOrder?.length > 0 &&
          prependColumns.map((item, i) => (
            <GridHeadCellStatic data-test-id="grid-head-cell-static" key={`prepend-${i}`}>
              {item}
            </GridHeadCellStatic>
          ))}
        {
          /* Note that this.onResizeMouseDown assumes GridResizer is nested
            1 levels under GridHeadCell */
          columnOrder.map((column, i) => (
            <GridHeadCell
              data-test-id="grid-head-cell"
              key={`${i}.${column.key}`}
              isFirst={i === 0}
              sticky={stickyHeader}
            >
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
      <GridRow key={row} data-test-id="grid-body-row">
        {prependColumns &&
          prependColumns.map((item, i) => (
            <GridBodyCell data-test-id="grid-body-cell" key={`prepend-${i}`}>
              {item}
            </GridBodyCell>
          ))}
        {columnOrder.map((col, i) => (
          <GridBodyCell data-test-id="grid-body-cell" key={`${col.key}${i}`}>
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
          <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
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
            <p>{t('No results found for your query')}</p>
          </EmptyStateWarning>
        </GridBodyCellStatus>
      </GridRow>
    );
  }

  render() {
    const {title, headerButtons, scrollable, height} = this.props;
    const showHeader = title || headerButtons;
    return (
      <Fragment>
        <Profiler id="GridEditable" onRender={onRenderCallback}>
          {showHeader && (
            <Header>
              {title && <HeaderTitle>{title}</HeaderTitle>}
              {headerButtons && (
                <HeaderButtonContainer>{headerButtons()}</HeaderButtonContainer>
              )}
            </Header>
          )}
          <Body>
            <Grid
              data-test-id="grid-editable"
              scrollable={scrollable}
              height={height}
              ref={this.refGrid}
            >
              <GridHead>{this.renderGridHead()}</GridHead>
              <GridBody>{this.renderGridBody()}</GridBody>
            </Grid>
          </Body>
        </Profiler>
      </Fragment>
    );
  }
}

export default GridEditable;
