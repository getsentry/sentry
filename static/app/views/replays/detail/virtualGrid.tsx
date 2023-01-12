import {createContext, forwardRef, ReactElement} from 'react';
import {
  GridChildComponentProps,
  VariableSizeGrid,
  VariableSizeGridProps,
} from 'react-window';

export type HeaderRendererProps<T> = Omit<GridChildComponentProps<T>, 'isScrolling'>;
export type CellRendererProps<T> = GridChildComponentProps<T>;

type Props<T> = {
  cellRenderer: (props: CellRendererProps<T>) => ReactElement;
  headerHeight: number;
  headerRenderer: (props: HeaderRendererProps<T>) => ReactElement | null;
} & Omit<VariableSizeGridProps<T>, 'children'>;

type GridContextType<T = any> = {
  Header: Props<T>['headerRenderer'];
  columnCount: number;
  columnWidth: (index: number) => number;
  headerHeight: Props<T>['headerHeight'];
  itemData: T;
};

const StickyGridContext = createContext<GridContextType>({
  Header: () => null,
  columnCount: 0,
  columnWidth: () => 0,
  headerHeight: 0,
  itemData: undefined,
});
StickyGridContext.displayName = 'StickyGridContext';

const innerElementType = forwardRef<HTMLDivElement>(({children, ...rest}, ref) => {
  return (
    <StickyGridContext.Consumer>
      {({Header, columnCount, columnWidth, headerHeight, itemData}) => {
        const headers = new Array(columnCount).fill(1).map((_1, col) => {
          const left = new Array(col)
            .fill(1)
            .reduce((sum, _2, c) => sum + columnWidth(c), 0);
          return (
            <Header
              key={`${col}-0`}
              columnIndex={col}
              rowIndex={0}
              data={itemData}
              style={{
                position: 'absolute',
                height: headerHeight,
                left,
                top: 0,
                width: columnWidth(col),
              }}
            />
          );
        });

        return (
          <div ref={ref} {...rest}>
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}
            >
              {headers}
            </div>
            <div
              style={{
                position: 'relative',
                top: headerHeight,
              }}
            >
              {children}
            </div>
          </div>
        );
      }}
    </StickyGridContext.Consumer>
  );
});

const VirtualGrid = forwardRef(function grid<T>(
  {cellRenderer, headerRenderer, headerHeight, ...gridProps}: Props<T>,
  ref
) {
  const {columnCount, columnWidth, itemData} = gridProps;
  return (
    <StickyGridContext.Provider
      value={{Header: headerRenderer, columnCount, columnWidth, headerHeight, itemData}}
    >
      <VariableSizeGrid ref={ref} innerElementType={innerElementType} {...gridProps}>
        {cellRenderer}
      </VariableSizeGrid>
    </StickyGridContext.Provider>
  );
});

export default VirtualGrid;
