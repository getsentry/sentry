import React from 'react';
import {MultiGrid, AutoSizer} from 'react-virtualized';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import AutoSelectText from 'app/components/autoSelectText';
import Link from 'app/components/link';
import InlineSvg from 'app/components/inlineSvg';
import Panel from 'app/components/panels/panel';
import {getDisplayValue, getDisplayText} from './utils';

/**
 * Renders results in a table as well as a query summary (timing, rows returned)
 * from any Snuba result
 */
export default class ResultTable extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    query: PropTypes.object.isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  componentWillReceiveProps(nextProps) {
    if (this.props.data.meta !== nextProps.data.meta) {
      this.grid.recomputeGridSize();
    }
  }

  cellRenderer = ({key, rowIndex, columnIndex, style}) => {
    const {query, data: {data}} = this.props;
    const cols = this.getColumnList();

    const showEventLinks = !query.aggregations.length;

    const isLinkCol = showEventLinks && columnIndex === cols.length;

    const isSpacingCol = typeof cols[columnIndex] === 'undefined';

    const colName = isLinkCol || isSpacingCol ? null : cols[columnIndex].name;

    if (rowIndex === 0) {
      return (
        <TableHeader key={key} style={style}>
          <strong>{colName}</strong>
        </TableHeader>
      );
    }

    const value = isLinkCol
      ? this.getLink(data[rowIndex - 1])
      : isSpacingCol ? null : getDisplayValue(data[rowIndex - 1][colName]);

    const isNumber = !isLinkCol && typeof data[rowIndex - 1][colName] === 'number';

    const align = isNumber ? 'right' : isLinkCol ? 'center' : 'left';

    return (
      <Cell key={key} style={style} isOddRow={rowIndex % 2 === 1} align={align}>
        <AutoSelectText>{value}</AutoSelectText>
      </Cell>
    );
  };

  getLink = event => {
    const {slug, projects} = this.context.organization;
    const projectSlug = projects.find(project => project.id === `${event.project_id}`)
      .slug;

    return (
      <Link
        to={`/${slug}/${projectSlug}/issues/?query=${event.event_id}`}
        target="_blank"
      >
        <InlineSvg src="icon-exit" size="1em" />
      </Link>
    );
  };

  // Returns an array of column widths for each column in the table.
  // Estimates the column width based on the header row and the first three rows
  // of data. Since this might be expensive, we'll only do this if there are
  // less than 20 columns of data to check.
  // Adds an empty column at the end with the remaining table width if any.
  getColumnWidths = tableWidth => {
    const MIN_COL_WIDTH = 100;
    const MAX_COL_WIDTH = 400;
    const LINK_COL_WIDTH = 40;

    const {query, data: {data}} = this.props;
    const cols = this.getColumnList();

    const widths = [];

    const showEventLinks = !query.aggregations.length;

    if (cols.length < 20) {
      cols.forEach(col => {
        const colName = col.name;
        const sizes = [this.measureText(colName, true)];

        // Check the first 3 rows to set column width
        data.slice(0, 3).forEach(row => {
          sizes.push(this.measureText(getDisplayText(row[colName]), false));
        });

        // Ensure size is within max and min bounds, add 20px for cell padding
        const width = Math.max(
          Math.min(Math.max(...sizes) + 20, MAX_COL_WIDTH),
          MIN_COL_WIDTH
        );

        widths.push(width);
      });
    } else {
      cols.forEach(() => {
        widths.push(MIN_COL_WIDTH);
      });
    }

    if (showEventLinks) {
      widths.push(LINK_COL_WIDTH);
    }

    const sumOfWidths = widths.reduce((sum, w) => sum + w, 0) + 2;

    // Add a fake column of remaining width
    widths.push(Math.max(tableWidth - sumOfWidths, 0));

    return widths;
  };

  getColumnList = () => {
    const {query, data: {meta}} = this.props;

    const fields = new Set(query.fields);

    return !query.aggregations.length && query.fields.length
      ? meta.filter(({name}) => fields.has(name))
      : meta;
  };

  measureText = (text, isHeader) => {
    // Create canvas once in order to measure column widths
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
    }
    const context = this.canvas.getContext('2d');
    context.font = isHeader ? 'bold 14px Rubik' : 'normal 14px Rubik';
    return Math.ceil(context.measureText(text).width);
  };

  renderTable() {
    const {query, data: {data}} = this.props;

    const cols = this.getColumnList();

    const showEventLinks = !query.aggregations.length;

    // Add one column at the end to make sure table spans full width
    const colCount = cols.length + (showEventLinks ? 1 : 0) + 1;

    const maxVisibleResults = Math.min(data.length, 10);

    return (
      <GridContainer visibleRows={maxVisibleResults + 1}>
        <AutoSizer>
          {({width, height}) => {
            const columnWidths = this.getColumnWidths(width);
            return (
              <MultiGrid
                ref={ref => (this.grid = ref)}
                width={width - 1}
                height={height}
                rowCount={data.length + 1}
                columnCount={colCount}
                fixedRowCount={1}
                rowHeight={41} // Add 1px for border
                columnWidth={({index}) => columnWidths[index]}
                cellRenderer={this.cellRenderer}
              />
            );
          }}
        </AutoSizer>
      </GridContainer>
    );
  }

  render() {
    const {error} = this.props.data;

    if (error) {
      return <div>{error}</div>;
    }

    return <div>{this.renderTable()}</div>;
  }
}

const GridContainer = styled(({visibleRows, ...props}) => <Panel {...props} />)`
  height: ${p =>
    p.visibleRows * 41 +
    2}px; /* cell height + cell border + top and bottom Panel border */
  overflow: hidden;

  .ReactVirtualized__Grid {
    outline: none;
  }
`;

const Cell = styled('div')`
  ${p => !p.isOddRow && `background-color: ${p.theme.whiteDark};`} ${p =>
      `text-align: ${p.align};`} overflow: scroll;
  font-size: 14px;
  line-height: 40px;
  padding: 0 10px;
  border-top: 1px solid ${p => p.theme.borderLight};

  ::-webkit-scrollbar {
    display: none;
  }

  @-moz-document url-prefix() {
    overflow: hidden;
  }

  -ms-overflow-style: -ms-autohiding-scrollbar;
`;

const TableHeader = styled(Cell)`
  background: ${p => p.theme.offWhite};
  color: ${p => p.theme.gray3};
  border-top: none;
  border-bottom: 1px solid ${p => p.theme.borderDark};
  &:first-of-type {
    border-top-left-radius: 3px;
  }
`;
