import React from 'react';
import {MultiGrid, AutoSizer} from 'react-virtualized';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import Link from 'app/components/link';
import Tooltip from 'app/components/tooltip';
import Panel from 'app/components/panels/panel';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import withOrganization from 'app/utils/withOrganization';

import {getDisplayValue, getDisplayText} from './utils';

const TABLE_ROW_HEIGHT = 30;
const TABLE_ROW_BORDER = 1;
const TABLE_ROW_HEIGHT_WITH_BORDER = TABLE_ROW_HEIGHT + TABLE_ROW_BORDER;
const MIN_COL_WIDTH = 100;
const MAX_COL_WIDTH = 500;
const CELL_PADDING = 20;
const MIN_VISIBLE_ROWS = 6;
const MAX_VISIBLE_ROWS = 30;
const OTHER_ELEMENTS_HEIGHT = 70; // pagination buttons, query summary

/**
 * Renders results in a table as well as a query summary (timing, rows returned)
 * from any Snuba result
 */
class ResultTable extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    data: PropTypes.object.isRequired,
    query: PropTypes.object.isRequired,
    height: PropTypes.number,
    width: PropTypes.number,
  };

  componentDidUpdate(prevProps) {
    if (this.props.data.meta !== prevProps.data.meta) {
      this.grid.recomputeGridSize();
    }

    if (this.props.width !== prevProps.width) {
      this.forceUpdate(() => this.grid.recomputeGridSize());
    }
  }

  getCellRenderer = cols => ({key, rowIndex, columnIndex, style}) => {
    const {data: {data, meta}} = this.props;

    const isSpacingCol = columnIndex === cols.length;

    const colName = isSpacingCol ? null : cols[columnIndex].name;

    const isNumberCol =
      !isSpacingCol && ['number', 'integer'].includes(meta[columnIndex].type);

    const align = isNumberCol && colName != 'issue.id' ? 'right' : 'left';

    if (rowIndex === 0) {
      return (
        <TableHeader key={key} style={style} align={align}>
          <strong>{colName}</strong>
        </TableHeader>
      );
    }

    let value = isSpacingCol ? null : getDisplayValue(data[rowIndex - 1][colName]);

    // check for id column
    if (columnIndex < cols.length && cols[columnIndex].name === 'id') {
      value = this.getEventLink(data[rowIndex - 1]);
    }

    // check for issue.id columm
    if (columnIndex < cols.length && cols[columnIndex].name === 'issue.id') {
      value = this.getIssueLink(data[rowIndex - 1]);
    }

    return (
      <Cell key={key} style={style} isOddRow={rowIndex % 2 === 1} align={align}>
        {value}
      </Cell>
    );
  };

  hasSentry10 = () => {
    return new Set(this.props.organization.features).has('sentry10');
  };

  getEventLink = event => {
    const {slug, projects} = this.props.organization;
    const projectSlug = projects.find(project => project.id === `${event['project.id']}`)
      .slug;

    const basePath = this.hasSentry10()
      ? `/organizations/${slug}/projects/${projectSlug}/`
      : `/${slug}/${projectSlug}/`;

    return (
      <Tooltip title={t('Open event')}>
        <Link href={`${basePath}events/${event.id}/`} target="_blank">
          {event.id}
        </Link>
      </Tooltip>
    );
  };

  getIssueLink = event => {
    const {slug, projects} = this.props.organization;
    const projectSlug = projects.find(project => project.id === `${event['project.id']}`)
      .slug;

    const basePath = this.hasSentry10()
      ? `/organizations/${slug}/`
      : `/${slug}/${projectSlug}/`;

    return (
      <Tooltip title={t('Open issue')}>
        <Link to={`${basePath}issues/${event['issue.id']}`} target="_blank">
          {event['issue.id']}
        </Link>
      </Tooltip>
    );
  };

  // Returns an array of column widths for each column in the table.
  // Estimates the column width based on the header row and the longest three
  // rows of data. Since this might be expensive, we'll only do this if there\
  // are less than 20 columns of data to check in total.
  // Adds an empty column at the end with the remaining table width if any.
  getColumnWidths = tableWidth => {
    const {data: {data}} = this.props;
    const cols = this.getColumnList();

    const widths = [];

    if (cols.length < 20) {
      cols.forEach(col => {
        const colName = col.name;
        const sizes = [this.measureText(colName, true)];

        // Get top 3 unique results sorted by string length
        // We want to avoid calling measureText() too much so only do this
        // for the top 3 longest strings
        const uniqs = [...new Set(data.map(row => row[colName]))]
          .map(colData => getDisplayText(colData))
          .sort((a, b) => b.length - a.length)
          .slice(0, 3);

        uniqs.forEach(colData => {
          sizes.push(this.measureText(colData, false));
        });

        // Ensure size is within max and min bounds, add 20px for cell padding
        const width = Math.max(
          Math.min(Math.max(...sizes) + CELL_PADDING, MAX_COL_WIDTH),
          MIN_COL_WIDTH
        );

        widths.push(width);
      });
    } else {
      cols.forEach(() => {
        widths.push(MIN_COL_WIDTH);
      });
    }

    const sumOfWidths = widths.reduce((sum, w) => sum + w, 0) + 2;

    // Add a fake column of remaining width
    widths.push(Math.max(tableWidth - sumOfWidths, 0));

    return widths;
  };

  getRowHeight = (rowIndex, columnsToCheck) => {
    const {data: {data}} = this.props;

    if (rowIndex === 0) {
      return TABLE_ROW_HEIGHT_WITH_BORDER;
    }

    const row = data[rowIndex - 1]; // -1 offset due to header row
    const colWidths = columnsToCheck.map(col => {
      return this.measureText(getDisplayText(row[col]), false);
    });
    const maxColWidth = Math.max(...colWidths, 0);

    // Number of rows to be rendered based on text content divided by cell width
    // Apply a min of 1 and max of 3
    const rows = Math.max(
      Math.min(Math.ceil(maxColWidth / (MAX_COL_WIDTH - CELL_PADDING)), 3),
      1
    );

    return TABLE_ROW_HEIGHT * rows + TABLE_ROW_BORDER;
  };

  getColumnList = () => {
    const {query, data: {meta}} = this.props;

    const fields = new Set([
      ...(query.fields || []),
      ...query.aggregations.map(agg => agg[2]),
    ]);

    return meta.filter(({name}) => fields.has(name));
  };

  measureText = (text, isHeader) => {
    // Create canvas once in order to measure column widths
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
    }
    const context = this.canvas.getContext('2d');
    context.font = isHeader ? 'bold 14px Rubik' : 'normal 14px Rubik';

    // The measureText function sometimes slightly miscalculates text width.
    // Add 5px to compensate since we want to avoid rows breaking unnecessarily.
    // (better to over than under estimate)
    return Math.ceil(context.measureText(text).width) + 5;
  };

  getMaxVisibleRows = elementHeight => {
    if (!elementHeight) {
      return MIN_VISIBLE_ROWS;
    }

    // subtract header row, pagination buttons and query summary
    const height = elementHeight - TABLE_ROW_HEIGHT_WITH_BORDER - OTHER_ELEMENTS_HEIGHT;

    const visibleRows = Math.floor(height / TABLE_ROW_HEIGHT_WITH_BORDER);

    // Apply min/max
    return Math.max(Math.min(visibleRows, MAX_VISIBLE_ROWS), MIN_VISIBLE_ROWS);
  };

  renderTable() {
    const {data: {data}, height} = this.props;

    const cols = this.getColumnList();

    // Add one column at the end to make sure table spans full width
    const colCount = cols.length + 1;

    const visibleRows = this.getMaxVisibleRows(height);

    const cellRenderer = this.getCellRenderer(cols);

    return (
      <Panel>
        <Grid visibleRows={Math.min(data.length, visibleRows) + 1}>
          <AutoSizer>
            {size => {
              const columnWidths = this.getColumnWidths(size.width);

              // Since calculating row height might be expensive, we'll only
              // perform the check against a subset of columns (where col width
              // has exceeded the max value)
              const columnsToCheck = columnWidths.reduce((acc, colWidth, idx) => {
                if (colWidth === MAX_COL_WIDTH) {
                  acc.push(cols[idx].name);
                }
                return acc;
              }, []);

              return (
                <MultiGrid
                  ref={ref => (this.grid = ref)}
                  width={size.width - 1}
                  height={size.height}
                  rowCount={data.length + 1}
                  columnCount={colCount}
                  fixedRowCount={1}
                  rowHeight={({index}) => this.getRowHeight(index, columnsToCheck)}
                  columnWidth={({index}) => columnWidths[index]}
                  cellRenderer={cellRenderer}
                  overscanByPixels={800}
                />
              );
            }}
          </AutoSizer>
        </Grid>
        {!data.length && (
          <EmptyStateWarning small={true}>{t('No results')}</EmptyStateWarning>
        )}
      </Panel>
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

export {ResultTable};
export default withOrganization(ResultTable);

const Grid = styled(({visibleRows, ...props}) => <div {...props} />)`
  height: ${p =>
    p.visibleRows * TABLE_ROW_HEIGHT_WITH_BORDER +
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
  line-height: ${TABLE_ROW_HEIGHT}px;
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
