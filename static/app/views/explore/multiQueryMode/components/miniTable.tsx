import React from 'react';
import styled from '@emotion/styled';

import {Body, Grid} from 'sentry/components/gridEditable/styles';

interface TableProps extends React.ComponentProps<typeof _TableWrapper> {}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({children, styles, ...props}, ref) => (
    <_TableWrapper {...props}>
      <_Table
        ref={ref}
        style={styles}
        scrollable={props.scrollable}
        height={props.height}
      >
        {children}
      </_Table>
    </_TableWrapper>
  )
);

const _TableWrapper = styled(Body)`
  overflow-x: hidden;
`;

const _Table = styled(Grid)<{height?: string | number; scrollable?: boolean}>`
  ${p =>
    p.scrollable &&
    `
  overflow-x: scroll;
  overflow-y: scroll;
  `}
`;
