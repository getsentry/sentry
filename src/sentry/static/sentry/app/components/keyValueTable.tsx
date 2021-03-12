import React from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {};

export const KeyValueTable = styled('dl')`
  display: grid;
  grid-template-columns: 50% 50%;
`;

export const Key = styled('dt')`
  ${overflowEllipsis};
  &:nth-of-type(2n-1) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

export const Value = styled('dd')`
  ${overflowEllipsis};
  text-align: right;
  &:nth-of-type(2n-1) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

export function KeyValueTable2({data}) {
  return (
    <KeyValueTable>
      {data.map(([key, value]) => {
        return (
          <React.Fragment key={key}>
            <Key>{key}</Key> <Value>{value}</Value>
          </React.Fragment>
        );
      })}
    </KeyValueTable>
  );
}
