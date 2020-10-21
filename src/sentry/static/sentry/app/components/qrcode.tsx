import styled from '@emotion/styled';

type Props = {
  code: (1 | 0)[][];
};

const Qrcode = ({code}: Props) => (
  <Table>
    <tbody>
      {code.map((row, i) => (
        <tr key={i}>
          {row.map((cell, j) => (cell ? <BlackCell key={j} /> : <WhiteCell key={j} />))}
        </tr>
      ))}
    </tbody>
  </Table>
);

const Cell = styled('td')`
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

const Table = styled('table')`
  margin: 0;
`;

export default Qrcode;
