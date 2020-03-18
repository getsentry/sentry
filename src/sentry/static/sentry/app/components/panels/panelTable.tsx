import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import Panel from './panel';

type Props = {
  disablePadding?: boolean;
  columns: number;
  children: React.ReactNode;
};

/**
 * Bare bones table that treats the first `this.props.columns` as a header
 *
 * The number of children elements should be a multiple of `this.props.columns` to have
 * it look ok.
 */
const PanelTable = ({columns: _, children, ...props}: Props) => (
  <Panel {...props}>{children}</Panel>
);

export default styled(PanelTable)<Props>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, auto);

  > *:nth-child(-n + ${p => p.columns}) {
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
  }
  > * {
    padding: ${p => (p.disablePadding ? 0 : space(2))};
  }
`;

// 0 1 2
//
//
