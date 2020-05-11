import React from 'react';

import {BreadCrumbIconWrapper} from '../styles';
import {IconProps} from '../../breadcrumbs/types';
import {BreadcrumbDetails} from './types';

const BreadcrumbFilterGroupIcon = ({
  icon,
  color,
  borderColor,
}: Omit<BreadcrumbDetails, 'description'>) => {
  if (!icon) return null;

  const Icon = icon as React.ComponentType<IconProps>;

  return (
    <BreadCrumbIconWrapper color={color} borderColor={borderColor} size={20}>
      <Icon size="xs" />
    </BreadCrumbIconWrapper>
  );
};

export default BreadcrumbFilterGroupIcon;
