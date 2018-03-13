import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

const Cell = styled.td`
  height: 6px;
  width: 6px;
  padding: 0;
`;
const BlackCell = styled(Cell)`
  background-color: black;
`;
const WhiteCell = styled(Cell)`
  background-color: white;
`;

const Table = styled.table`
  margin: 0;
`;

class Qrcode extends React.Component {
  static propTypes = {
    /**
     * Takes a multidimensional array representing a 2-bit, 2d matrix
     */
    code: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  };

  render() {
    let {code} = this.props;
    return (
      <Table>
        <tbody>
          {code.map((row, i) => (
            <tr key={i}>
              {row.map(
                (cell, j) => (cell ? <BlackCell key={j} /> : <WhiteCell key={j} />)
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    );
  }
}

export default Qrcode;
