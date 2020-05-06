import React from 'react';

import {IconProps} from 'app/types/iconProps';

import {BreadCrumbIconWrapper} from './styles';
import {BreadcrumbDetails} from '../breadcrumbs/types';

type Props = Omit<BreadcrumbDetails, 'description'> & Pick<IconProps, 'size'>;

const BreadcrumbIcon = ({icon, color, borderColor, size}: Props) => {
  const Icon = icon as React.ComponentType<IconProps>;
  return (
    <BreadCrumbIconWrapper color={color} borderColor={borderColor}>
      <Icon size={size} />
    </BreadCrumbIconWrapper>
  );
};

export default BreadcrumbIcon;
