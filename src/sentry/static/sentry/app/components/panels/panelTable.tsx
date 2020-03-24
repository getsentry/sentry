import React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import Panel from './panel';

type Props = {
  disablePadding?: boolean;
  headers: React.ReactNode[];
  children: React.ReactNode;
} & Omit<typeof Panel, 'title' | 'body'>;

/**
 * Bare bones table that treats the first `this.props.columns` as a header
 *
 * The number of children elements should be a multiple of `this.props.columns` to have
 * it look ok.
 *
 *
 * Potential customizations:
 * - [ ] Add borders for columns to make them more like cells
 * - [ ] Add prop to disable borders for rows
 * - [ ] We may need to wrap `children` with our own component (similar to what we're doing
 *       with `headers`. Then we can get rid of that gross `> *` selector
 * - [ ] Allow customization of wrappers (Header and body cells if added)
 */
const PanelTable = ({headers, children, disablePadding, ...props}: Props) => (
  <Wrapper columns={headers.length} disablePadding={disablePadding} {...props}>
    {headers.map((header, i) => (
      <PanelTableHeader key={i}>{header}</PanelTableHeader>
    ))}
    {children}
  </Wrapper>
);

type WrapperProps = {
  /**
   * The number of columns the table will have, this is derived from the headers list
   */
  columns: number;
  disablePadding: Props['disablePadding'];
};

const Wrapper = styled(Panel, {
  shouldForwardProp: p => isPropValid(p) && p !== 'columns',
})<WrapperProps>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, auto);

  > * {
    padding: ${p => (p.disablePadding ? 0 : space(2))};
    border-bottom: 1px solid ${p => p.theme.borderDark};

    &:nth-child(-${p => p.columns}) {
      border-bottom: none;
    }
  }
`;

const PanelTableHeader = styled('div')`
  align-items: center;
  justify-content: space-between;
  color: ${p => p.theme.gray3};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.offWhite};
  line-height: 1;
  position: relative;
`;

export default PanelTable;
