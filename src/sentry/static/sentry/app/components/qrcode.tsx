import React from 'react';
import styled from '@emotion/styled';

import {Authenticator} from 'app/types';

type Props = {
  code: NonNullable<(Authenticator & {id: 'totp'})['qrcode']>;
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
