import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import Panel from './panel';

type Props = {
  disablePadding?: boolean;
  headers: React.ReactNode[];
  children: React.ReactNode;
};

/**
 * Bare bones table that treats the first `this.props.columns` as a header
 *
 * The number of children elements should be a multiple of `this.props.columns` to have
 * it look ok.
 */
const PanelTable = ({headers, children, disablePadding}: Props) => (
  <Wrapper columns={headers.length} disablePadding={disablePadding}>
    {headers.map((header, i) => (
      <PanelTableHeader key={i}>{header}</PanelTableHeader>
    ))}
    {children}
  </Wrapper>
);

const Wrapper = styled(Panel)<{columns: number; disablePadding: Props['disablePadding']}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, auto);

  > * {
    padding: ${p => (p.disablePadding ? 0 : space(2))};
  }
`;

const PanelTableHeader = styled('div')`
  align-items: center;
  justify-content: space-between;
  color: ${p => p.theme.gray3};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.offWhite};
  line-height: 1;
  position: relative;
`;

export default PanelTable;
