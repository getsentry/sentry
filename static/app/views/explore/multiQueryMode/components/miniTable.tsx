import type React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Body, Grid} from 'sentry/components/tables/gridEditable/styles';

interface TableProps extends React.ComponentProps<typeof _TableWrapper> {
  height?: string | number;
  ref?: React.Ref<HTMLTableElement>;
  scrollable?: boolean;
}

export function Table({ref, children, style, height, scrollable, ...props}: TableProps) {
  return (
    <_TableWrapper {...props}>
      <_Table ref={ref} style={style} scrollable={scrollable} height={height}>
        {children}
      </_Table>
    </_TableWrapper>
  );
}

const _TableWrapper = styled(Body)`
  overflow-x: hidden;
  margin: 0;
`;

const _Table = styled(Grid)<{height?: string | number; scrollable?: boolean}>`
  ${p =>
    p.scrollable &&
    css`
      overflow-y: auto;
    `}
`;
