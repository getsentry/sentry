import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import {IconEllipsis} from 'app/icons';
import space from 'app/styles/space';

import {GridCell, IconWrapper} from './styles';

type Props = {
  onClick: () => void;
  quantity: number;
};

const BreadcrumbCollapsed = ({quantity, onClick}: Props) => (
  <StyledGridCell data-test-id="breadcrumb-collapsed" withBeforeContent onClick={onClick}>
    <IconWrapper>
      <IconEllipsis />
    </IconWrapper>
    {tct('Show [quantity] collapsed crumbs', {quantity})}
  </StyledGridCell>
);

export default BreadcrumbCollapsed;

const StyledGridCell = styled(GridCell)`
  cursor: pointer;
  background: ${p => p.theme.whiteDark};
  margin: 0 -1px;
  border-left: 1px solid ${p => p.theme.borderLight};
  border-right: 1px solid ${p => p.theme.borderLight};
  font-size: ${p => p.theme.fontSizeMedium};
  grid-column-start: 1;
  grid-column-end: -1;
  display: grid;
  grid-gap: ${space(1.5)};
  grid-template-columns: max-content 1fr;
`;
