import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {
  category?: string;
};

const BreadcrumbCategory = ({category = 'generic'}: Props) => (
  <div>
    <Tooltip title={category}>
      <Category title={category}>{category}</Category>
    </Tooltip>
  </div>
);

export default BreadcrumbCategory;

const Category = styled('div')`
  color: ${p => p.theme.gray5};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 700;
  ${overflowEllipsis};
`;
