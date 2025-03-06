import {type CSSProperties, useCallback, useRef} from 'react';
import {useResizeObserver} from '@react-aria/utils';

import {
  Body as Panel,
  Grid,
  GridBody,
  GridBodyCell,
  GridBodyCellStatus,
  GridHead,
  GridHeadCellStatic,
  GridRow,
} from 'sentry/components/gridEditable/styles';

export interface ColumnConfig<Cell> {
  Header: () => React.ReactNode;
  Cell?: (props: {value: Cell}) => React.ReactNode;
  /** @default 1fr */
  width?: CSSProperties['gridTemplateColumns'];
}

interface TableProps<
  Data extends Record<string, unknown>,
  ColumnId extends string = keyof Data extends string ? keyof Data : string,
> {
  data: Data[];
  columns?: {[Property in ColumnId]: ColumnConfig<Data[Property]>};
  fallback?: React.ReactNode;
}

export function defineColumns<Data extends {[Property in keyof Data]: unknown}>(columns: {
  [Property in keyof Data]: ColumnConfig<Data[Property]>;
}) {
  return columns;
}

export function SimpleTable<
  Data extends Record<string, any>,
  ColumnId extends string = keyof Data extends string ? keyof Data : string,
>({columns, data, fallback}: TableProps<Data, ColumnId>) {
  const columnIds = Object.keys(columns ?? data.at(0) ?? {}) as unknown as ColumnId[];
  const tableRef = useRef<HTMLTableElement>(null);
  const onResize = useCallback(() => {
    if (!tableRef.current) {
      return;
    }
  }, [tableRef]);
  useResizeObserver({ref: tableRef, onResize});

  return (
    <Panel>
      <Grid
        ref={tableRef}
        /** override grid-template-columns */
        style={{
          gridTemplateColumns: columnIds
            .map(colId => columns?.[colId]?.width ?? 'minmax(0, 1fr)')
            .join(' '),
        }}
      >
        <GridHead>
          <GridRow data-row="header">
            {columnIds.map(colId => {
              const {Header = () => colId} = columns?.[colId] ?? {};
              return (
                <GridHeadCellStatic key={colId} data-column={colId}>
                  <Header />
                </GridHeadCellStatic>
              );
            })}
          </GridRow>
        </GridHead>
        <GridBody>
          {data.length > 0 ? (
            data.map((row, i) => (
              <GridRow key={i} data-row={i}>
                {columnIds.map(colId => {
                  const value = row[colId] as Data[ColumnId];
                  const {Cell = DefaultCell} = columns?.[colId] ?? {};
                  return (
                    <GridBodyCell key={colId} data-column={colId} data-row={i}>
                      <Cell value={value} />
                    </GridBodyCell>
                  );
                })}
              </GridRow>
            ))
          ) : (
            <GridRow>
              <GridBodyCellStatus>{fallback}</GridBodyCellStatus>
            </GridRow>
          )}
        </GridBody>
      </Grid>
    </Panel>
  );
}

function DefaultCell({value}: {value: unknown}) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
