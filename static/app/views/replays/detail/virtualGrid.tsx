import {createContext, forwardRef, ReactElement} from 'react';
import {
  GridChildComponentProps,
  VariableSizeGrid,
  VariableSizeGridProps,
} from 'react-window';

export type HeaderRendererProps<T> = Omit<GridChildComponentProps<T>, 'isScrolling'>;
export type BodyRendererProps<T> = GridChildComponentProps<T>;

type Props<T> = {
  bodyRenderer: (props: BodyRendererProps<T>) => ReactElement;
  headerHeight: `${number}px`;
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
  headerHeight: '0px',
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
                height: headerHeight,
                top: 0,
                zIndex: 2,
              }}
            >
              {headers}
            </div>
            <div style={{position: 'relative'}}>{children}</div>
          </div>
        );
      }}
    </StickyGridContext.Consumer>
  );
});

function VirtualGrid<T>({
  bodyRenderer,
  headerRenderer,
  headerHeight,
  ...gridProps
}: Props<T>) {
  const {columnCount, columnWidth, itemData} = gridProps;
  return (
    <StickyGridContext.Provider
      value={{Header: headerRenderer, columnCount, columnWidth, headerHeight, itemData}}
    >
      <VariableSizeGrid innerElementType={innerElementType} {...gridProps}>
        {bodyRenderer}
      </VariableSizeGrid>
    </StickyGridContext.Provider>
  );
}

export default VirtualGrid;
