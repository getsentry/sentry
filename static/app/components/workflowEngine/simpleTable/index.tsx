import type {CSSProperties} from 'react';

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

export interface ColumnConfig<Cell, Row> {
  Header: () => React.ReactNode;
  Cell?: (props: {row: Row; value: Cell}) => React.ReactNode;
  /** @default 1fr */
  width?: CSSProperties['gridTemplateColumns'];
}

interface TableProps<
  Data extends Record<string, unknown>,
  ColumnId extends string = keyof Data extends string ? keyof Data : string,
> {
  data: Data[];
  columns?: {[Property in ColumnId]?: ColumnConfig<Data[Property], Data>};
  fallback?: React.ReactNode;
}

export function defineColumns<Data extends {[Property in keyof Data]: unknown}>(columns: {
  [Property in keyof Data]?: ColumnConfig<Data[Property], Data>;
}) {
  return columns;
}

export function SimpleTable<
  Data extends Record<string, any>,
  ColumnId extends string = keyof Data extends string ? keyof Data : string,
>({columns, data, fallback}: TableProps<Data, ColumnId>) {
  const columnIds = Object.keys(columns ?? data.at(0) ?? {}) as unknown as ColumnId[];
  const gridTemplateColumns = columnIds
    .map(colId => columns?.[colId]?.width ?? 'minmax(0, 1fr)')
    .join(' ');

  return (
    <Panel>
      <Grid
        /** override grid-template-columns */
        style={{gridTemplateColumns}}
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
                      <Cell value={value} row={row} />
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
