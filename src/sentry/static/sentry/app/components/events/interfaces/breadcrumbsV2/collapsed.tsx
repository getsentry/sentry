import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import {IconEllipsis} from 'app/icons';
import space from 'app/styles/space';

import {GridCellLeft, IconWrapper} from './styles';

type Props = {
  onClick: () => void;
  quantity: number;
};

const Collapsed = ({quantity, onClick}: Props) => (
  <Wrapper data-test-id="breadcrumb-collapsed" onClick={onClick}>
    <IconWrapper>
      <IconEllipsis />
    </IconWrapper>
    {tct('Show [quantity] collapsed crumbs', {quantity})}
  </Wrapper>
);

export {Collapsed};

const Wrapper = styled(GridCellLeft)`
  cursor: pointer;
  background: ${p => p.theme.whiteDark};
  font-size: ${p => p.theme.fontSizeMedium};
  grid-column-start: 1;
  grid-column-end: -1;
  display: grid;
  grid-gap: ${space(1.5)};
  grid-template-columns: max-content 1fr;
`;
