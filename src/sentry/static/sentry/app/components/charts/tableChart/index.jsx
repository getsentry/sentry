import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelHeader, PanelItem} from 'app/components/panels';

export const TableChart = styled(
  class TableChartComponent extends React.Component {
    static propTypes = {
      data: PropTypes.arrayOf(
        PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number]))
      ),
      /**
       * The column index where your data starts.
       * This is used to calculate totals.
       *
       * Will not work if you have mixed string/number columns
       */
      dataStartIndex: PropTypes.number,
      widths: PropTypes.arrayOf(PropTypes.number),
      getValue: PropTypes.func,
      renderTableHeader: PropTypes.func,
      renderBody: PropTypes.func,
      renderHeaderCell: PropTypes.func,
      renderDataCell: PropTypes.func,
      shadeRowPercentage: PropTypes.bool,
      showRowTotal: PropTypes.bool,
      showColumnTotal: PropTypes.bool,
      rowTotalLabel: PropTypes.string,
      columnTotalLabel: PropTypes.string,
    };

    static get defaultProps() {
      // Default renderer for Table Header
      const defaultRenderTableHeader = ({
        headers,
        renderRow,
        rowTotalLabel,
        showRowTotal,
        ...props
      }) => {
        const headersWithTotalColumn = [
          ...(headers || []),
          ...(showRowTotal ? [rowTotalLabel] : []),
        ];

        return (
          <PanelHeader>
            {renderRow({
              isTableHeader: true,
              items: headersWithTotalColumn,
              rowIndex: -1,
              showRowTotal,
              ...props,
            })}
          </PanelHeader>
        );
      };

      // Default renderer for Table Body (all the data rows)
      const defaultRenderBody = ({
        widths,
        data,
        dataTotals,
        dataMaybeWithTotals,
        renderRow,
        shadeRowPercentage,
        showRowTotal,
        ...props
      }) =>
        dataMaybeWithTotals.map((row, rowIndex) => {
          let lastRowIndex = dataMaybeWithTotals.length - 1;
          let isLastRow = rowIndex === lastRowIndex;
          let showBar = !isLastRow && shadeRowPercentage;

          // rowTotals does not include the grand total of data
          let rowTotal =
            showRowTotal && rowIndex < data.length
              ? [dataTotals.rowTotals[rowIndex]]
              : [];

          return (
            <TableChartRow
              key={rowIndex}
              showBar={showBar}
              value={dataTotals.rowTotals[rowIndex]}
              total={dataTotals.total}
              widths={widths}
            >
              {renderRow({
                css: {zIndex: showBar ? '2' : undefined},
                ...props,
                data,
                widths,
                items: [...row, ...rowTotal],
                rowIndex,
                showRowTotal,
              })}
            </TableChartRow>
          );
        });

      // Default renderer for ALL rows (including header + body so that both can share the same DOM structure + styles)
      const defaultRenderRow = ({
        dataStartIndex,
        css,
        items,
        rowHeaders,
        rowData,
        isTableHeader,
        rowIndex,
        renderCell,
        showRowTotal,
        rowTotalWidth,
        widths,
        ...props
      }) => {
        return (
          <Flex flex={1} css={css}>
            {items &&
              items.slice(0, dataStartIndex).map((rowHeaderValue, columnIndex) =>
                renderCell({
                  isTableHeader,
                  isHeader: true,
                  value: rowHeaderValue,
                  columnIndex,
                  rowIndex,
                  width:
                    columnIndex < widths.length
                      ? widths[columnIndex]
                      : showRowTotal ? rowTotalWidth : null,
                  showRowTotal,
                  ...props,
                })
              )}

            <DataGroup>
              {items &&
                items.slice(dataStartIndex).map((rowDataValue, columnIndex) => {
                  let index = columnIndex + dataStartIndex;
                  let renderCellProps = {
                    isTableHeader,
                    value: rowDataValue,
                    columnIndex: index,
                    rowIndex,
                    width:
                      index < widths.length
                        ? widths[index]
                        : showRowTotal ? rowTotalWidth : null,
                    justify: 'right',
                    showRowTotal,
                    ...props,
                  };

                  return renderCell(renderCellProps);
                })}
            </DataGroup>
          </Flex>
        );
      };

      // Default renderer for ALL cells
      const defaultRenderCell = p => {
        let {
          isTableHeader,
          isHeader,
          justify,
          width,
          rowIndex,
          columnIndex,
          renderTableHeaderCell,
          renderHeaderCell,
          renderDataCell,
        } = p;

        return (
          <Cell justify={justify} width={width} key={`${rowIndex}-${columnIndex}`}>
            {isTableHeader
              ? renderTableHeaderCell(p)
              : isHeader ? renderHeaderCell(p) : renderDataCell(p)}
          </Cell>
        );
      };

      const defaultRenderDataCell = ({
        isTableHeader,
        justify,
        value,
        width,
        rowIndex,
        columnIndex,
      }) => value;
      const defaultRenderHeaderCell = defaultRenderDataCell;
      const defaultRenderTableHeaderCell = defaultRenderHeaderCell;

      return {
        dataStartIndex: 1,
        getValue: i => i,
        renderTableHeader: defaultRenderTableHeader,
        renderBody: defaultRenderBody,
        renderRow: defaultRenderRow,
        renderCell: defaultRenderCell,
        renderDataCell: defaultRenderDataCell,
        renderHeaderCell: defaultRenderHeaderCell,
        renderTableHeaderCell: defaultRenderTableHeaderCell,
        columnTotalLabel: 'Total',
        rowTotalLabel: 'Total',
        rowTotalWidth: 120,
      };
    }

    // TODO(billy): memoize?
    getTotals(rows) {
      if (!rows) return [];

      const {getValue, dataStartIndex} = this.props;

      const reduceSum = (sum, val) => (sum += getValue(val));
      const rowTotals = rows.map((row, rowIndex) =>
        row.slice(dataStartIndex).reduce(reduceSum, 0)
      );
      const columnTotals = rows.length
        ? rows[0]
            .slice(dataStartIndex)
            .map((r, currentColumn) =>
              rows.reduce(
                (sum, row) => (sum += getValue(row[currentColumn + dataStartIndex])),
                0
              )
            )
        : [];
      const total = columnTotals.reduce(reduceSum, 0);

      rowTotals.push(total);

      return {
        rowTotals,
        columnTotals,
        total,
      };
    }

    getDataWithTotals(dataTotals) {
      let {
        data,
        dataStartIndex,
        showRowTotal,
        showColumnTotal,
        columnTotalLabel,
      } = this.props;

      if (!data) return [];

      let totalRow = showColumnTotal
        ? [
            [
              // Label for Total Row
              columnTotalLabel,

              // Need to fill empty columns between label and `dataStartIndex`,
              ...[...Array(dataStartIndex - 1)].map(() => ''),

              // totals for each data column
              ...dataTotals.columnTotals,

              // grand total if `showRowTotal` is enabled
              ...(showRowTotal ? [dataTotals.total] : []),
            ],
          ]
        : [];

      return [...data, ...totalRow];
    }

    render() {
      let {
        className,
        children,
        data,
        dataStartIndex,
        getValue,
        showRowTotal,
        showColumnTotal,
        shadeRowPercentage,
        renderTableHeader,
        renderBody,
        widths,
        ...props
      } = this.props;

      // If we need to calculate totals...
      let dataTotals =
        showRowTotal || showColumnTotal || shadeRowPercentage ? this.getTotals(data) : [];
      let dataMaybeWithTotals = this.getDataWithTotals(dataTotals);

      // For better render customization
      let isRenderProp = typeof children === 'function';
      let renderProps = {
        data,
        dataTotals,
        dataMaybeWithTotals,
        dataStartIndex,
        getValue,
        showRowTotal,
        showColumnTotal,
        shadeRowPercentage,
        widths,
        ...props,
      };

      return (
        <Panel className={className}>
          {isRenderProp ? (
            children(renderProps)
          ) : (
            <React.Fragment>
              {renderTableHeader(renderProps)}
              {renderBody(renderProps)}
            </React.Fragment>
          )}
        </Panel>
      );
    }
  }
)`
  flex: 1;
`;

export default TableChart;

export const TableChartRow = styled(
  class extends React.Component {
    static propTypes = {
      /**
       * Show percentage as a bar in the row
       */
      showBar: PropTypes.bool,
      /**
       * Total value of row
       */
      value: PropTypes.number,
      /**
       * Total value of all rows
       */
      total: PropTypes.number,
    };

    render() {
      let {className, showBar, total, value, children} = this.props;
      let barWidth =
        total > 0 && typeof value === 'number' ? Math.round(value / total * 100) : 0;

      return (
        <PanelItem className={className}>
          {children}
          {showBar && <TableChartRowBar width={barWidth} />}
        </PanelItem>
      );
    }
  }
)`
  position: relative;
  flex: 1;
`;

/**
 * Shows relative percentage as width of bar inside of a table's row
 */
export const TableChartRowBar = styled(({width, ...props}) => <div {...props} />)`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: ${p => 100 - p.width}%;
  background-color: ${p => p.theme.offWhite2};
  z-index: 1;
`;

export const Cell = styled(Box)`
  z-index: 2;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${p => (!p.width ? 'flex: 1' : '')};
  ${p => (p.justify === 'right' ? 'text-align: right' : '')};
`;

const DataGroup = styled(Flex)`
  flex-shrink: 0;
`;
