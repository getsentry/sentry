import React from 'react';
import styled from '@emotion/styled';

import {tct, t} from 'app/locale';
import {IconEllipsis} from 'app/icons';
import space from 'app/styles/space';

import {GridCellLeft, IconWrapper, Grid} from './styles';

type Props = {
  onClick: () => void;
  quantity: number;
  hasBeenExpanded: boolean;
  isScrolling: boolean;
};

const ListCollapse = ({quantity, onClick, hasBeenExpanded, isScrolling}: Props) => {
  if (quantity <= 0) {
    return null;
  }

  const renderDescription = () => {
    if (isScrolling) {
      return t('scrolling\u2026');
    }

    if (hasBeenExpanded) {
      return tct('Hide [quantity] expanded crumbs', {quantity});
    }

    return tct('Show [quantity] collapsed crumbs', {quantity});
  };

  return (
    <StyledGrid isScrolling={isScrolling}>
      <Wrapper
        data-test-id="breadcrumb-collapsed"
        onClick={!isScrolling ? onClick : undefined}
      >
        <IconWrapper>
          <IconEllipsis />
        </IconWrapper>
        {renderDescription()}
      </Wrapper>
    </StyledGrid>
  );
};

export default ListCollapse;

const Wrapper = styled(GridCellLeft)`
  background: ${p => p.theme.gray100};
  font-size: ${p => p.theme.fontSizeMedium};
  grid-column-start: 1;
  grid-column-end: -1;
  display: grid;
  grid-gap: ${space(1.5)};
  grid-template-columns: max-content 1fr;
`;

const StyledGrid = styled(Grid)<{isScrolling: boolean}>`
  border-top: 0;
  position: relative;
  margin-bottom: -1px;
  z-index: 1;
  ${p => !p.isScrolling && 'cursor: pointer'};
`;
