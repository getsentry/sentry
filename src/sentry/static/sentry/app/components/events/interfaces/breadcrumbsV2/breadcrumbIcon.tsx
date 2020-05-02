import React from 'react';

import {IconProps} from 'app/types/iconProps';

import {BreadCrumbIconWrapper} from './styles';
import {BreadcrumbDetails} from '../breadcrumbs/types';

type Props = Omit<BreadcrumbDetails, 'description'>;

const BreadcrumbIcon = ({icon, color, borderColor}: Props) => {
  const Icon = icon as React.ComponentType<IconProps>;
  return (
    <BreadCrumbIconWrapper color={color} borderColor={borderColor}>
      <Icon />
    </BreadCrumbIconWrapper>
  );
};

export default BreadcrumbIcon;
