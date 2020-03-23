// TODO(matej): this could be moved to components to be reused in the future (also discover has something similar)
import React from 'react';
import styled from '@emotion/styled';

import Link from 'app/components/links/link';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

type Crumb = {
  label: string;
  to?: string;
};

type Props = {
  crumbs: Crumb[];
};

const Breadcrumbs = ({crumbs}: Props) => (
  <BreadcrumbList>
    {crumbs.map((crumb, index) => (
      <React.Fragment key={crumb.label}>
        <BreadcrumbItem to={crumb.to}>{crumb.label}</BreadcrumbItem>
        {index < crumbs.length - 1 && <StyledIcon size="xs" direction="right" />}
      </React.Fragment>
    ))}
  </BreadcrumbList>
);

export default Breadcrumbs;

const BreadcrumbList = styled('span')`
  display: flex;
  align-items: center;
  height: 40px;
`;

const BreadcrumbItem = styled(Link)`
  color: ${p => p.theme.gray2};

  &:last-child {
    color: ${p => p.theme.gray4};
    pointer-events: none;
  }

  &:hover,
  &:active {
    color: ${p => p.theme.gray3};
  }
`;

const StyledIcon = styled(IconChevron)`
  color: ${p => p.theme.gray2};
  margin: 0 ${space(1)} ${space(0.25)} ${space(1)};
`;
