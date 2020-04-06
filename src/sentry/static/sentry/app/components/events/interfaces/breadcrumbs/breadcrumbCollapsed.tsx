import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import {IconEllipsis} from 'app/icons/iconEllipsis';

import {BreadCrumb, BreadCrumbIconWrapper} from './styles';

type Props = {
  onClick: () => void;
  quantity: number;
};

const BreadcrumbCollapsed = ({quantity, onClick}: Props) => (
  <StyledBreadCrumb data-test-id="breadcrumb-collapsed" onClick={onClick}>
    <BreadCrumbIconWrapper>
      <IconEllipsis />
    </BreadCrumbIconWrapper>
    {tct('Show [quantity] collapsed crumbs', {quantity})}
  </StyledBreadCrumb>
);

export default BreadcrumbCollapsed;

// TODO(style): color #e7e4eb is not yet in theme
const StyledBreadCrumb = styled(BreadCrumb)`
  cursor: pointer;
  background: ${p => p.theme.whiteDark};
  margin: 0 -2px;
  border: 1px solid #e7e4eb;
  border-top: none;
`;
