import React from 'react';

import {IconWrapper} from '../styles';
import {IconProps} from '../types';
import {BreadcrumbDetails} from './types';

type Props = Omit<BreadcrumbDetails, 'description'>;

const BreadcrumbFilterGroupIcon = ({icon, color}: Props) => {
  if (!icon) return null;

  const Icon = icon as React.ComponentType<IconProps>;

  return (
    <IconWrapper color={color} size={20}>
      <Icon size="xs" />
    </IconWrapper>
  );
};

export default BreadcrumbFilterGroupIcon;
