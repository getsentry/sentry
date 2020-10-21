import * as React from 'react';
import styled from '@emotion/styled';

type Props = {
  children?: React.ReactNode;
  symbol?: React.ReactElement;
  className?: string;
};

const ListItem = styled(({children, className, symbol}: Props) => (
  <li className={className}>
    {symbol && <Symbol>{symbol}</Symbol>}
    {children}
  </li>
))`
  position: relative;
  ${p => p.symbol && `padding-left: 34px;`}
`;

const Symbol = styled('div')`
  display: flex;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  min-height: 22.5px;
`;

export default ListItem;
