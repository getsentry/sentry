import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import {IconEllipsis} from 'app/icons';
import space from 'app/styles/space';

import {BreadcrumbListItem, BreadCrumbIconWrapper} from './styles';

type Props = {
  onClick: () => void;
  quantity: number;
  hasBeenExpanded: boolean;
};

const BreadcrumbCollapsed = ({quantity, onClick, hasBeenExpanded}: Props) => (
  <StyledBreadcrumbListItem data-test-id="breadcrumb-collapsed" onClick={onClick}>
    <BreadCrumbIconWrapper>
      <IconEllipsis />
    </BreadCrumbIconWrapper>
    {hasBeenExpanded
      ? tct('Hide [quantity] expanded crumbs', {quantity})
      : tct('Show [quantity] collapsed crumbs', {quantity})}
  </StyledBreadcrumbListItem>
);

export default BreadcrumbCollapsed;

const StyledBreadcrumbListItem = styled(BreadcrumbListItem)`
  cursor: pointer;
  background: ${p => p.theme.whiteDark};
  margin: 0 -1px;
  border-right: 1px solid ${p => p.theme.borderLight};
  border-left: 1px solid ${p => p.theme.borderLight};
  grid-column-start: 1;
  grid-column-end: -1;
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1.5)};
  align-items: center;
`;
