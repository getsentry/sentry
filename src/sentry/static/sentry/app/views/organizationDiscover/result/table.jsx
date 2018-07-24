import React from 'react';
import {MultiGrid} from 'react-virtualized';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Box} from 'grid-emotion';

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
      <Cell key={key} style={style}>
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

    return (
      <MultiGrid
        width={800}
        height={300}
        rowCount={data.length + 1} // Add 1 for header row
        columnCount={meta.length}
        fixedRowCount={1}
        rowHeight={30}
        columnWidth={100}
        cellRenderer={this.cellRenderer}
      />
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

const Cell = styled('div')`
  overflow: scroll;
  font-size: 14px;
  padding: 1px;
`;

const Summary = styled(Box)`
  font-size: 12px;
`;
