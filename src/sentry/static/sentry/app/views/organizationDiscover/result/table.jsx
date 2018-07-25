import React from 'react';
import {MultiGrid, AutoSizer} from 'react-virtualized';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Box} from 'grid-emotion';

import theme from 'app/utils/theme';
import AutoSelectText from 'app/components/autoSelectText';

import {getDisplayValue} from './utils';
/**
 * Renders results in a table as well as a query summary (timing, rows returned)
 * from any Snuba result
 */
export default class Result extends React.Component {
  static propTypes = {
    result: PropTypes.object.isRequired,
  };

  cellRenderer = ({key, rowIndex, columnIndex, style}) => {
    const {meta, data} = this.props.result;
    const colName = meta[columnIndex].name;

    return (
      <Cell key={key} style={style} isOddRow={rowIndex % 2 === 1}>
        {rowIndex === 0 ? (
          <strong>{colName}</strong>
        ) : (
          <AutoSelectText>{getDisplayValue(data[rowIndex - 1][colName])}</AutoSelectText>
        )}
      </Cell>
    );
  };

  renderTable() {
    const {meta, data} = this.props.result;

    const maxVisibleResults = Math.min(data.length, 15);

    return (
      <GridContainer visibleRows={maxVisibleResults + 1}>
        <AutoSizer>
          {({width, height}) => (
            <MultiGrid
              width={width}
              height={height}
              rowCount={data.length + 1} // Add 1 for header row
              columnCount={meta.length}
              fixedRowCount={1}
              rowHeight={30}
              columnWidth={120}
              cellRenderer={this.cellRenderer}
              style={{border: `1px solid ${theme.borderLight}`}}
              styleTopRightGrid={{borderBottom: `2px solid ${theme.borderDark}`}}
            />
          )}
        </AutoSizer>
      </GridContainer>
    );
  }

  render() {
    const {error, timing, data} = this.props.result;

    if (error) {
      return <div>{error}</div>;
    }

    return (
      <div>
        <Summary mb={1}>
          snuba query time: {timing.duration_ms}ms, {data.length} rows
        </Summary>
        {this.renderTable()}
      </div>
    );
  }
}

const GridContainer = styled('div')`
  height: ${p => p.visibleRows * 30}px;

  .ReactVirtualized__Grid {
    outline: none;
  }
`;

const Cell = styled('div')`
  ${p => p.isOddRow && `background-color: ${p.theme.borderLighter};`} overflow: scroll;
  font-size: 14px;
  line-height: 30px;
  padding: 0 4px;
`;

const Summary = styled(Box)`
  font-size: 12px;
`;
