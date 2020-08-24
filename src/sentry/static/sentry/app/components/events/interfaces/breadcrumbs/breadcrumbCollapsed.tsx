import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import {IconEllipsis} from 'app/icons';

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

const StyledBreadCrumb = styled(BreadCrumb)`
  cursor: pointer;
  background: ${p => p.theme.gray100};
  margin: 0 -1px;
  border-right: 1px solid ${p => p.theme.border};
  border-left: 1px solid ${p => p.theme.border};
`;
