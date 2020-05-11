import React from 'react';

import SvgIcon from 'app/icons/svgIcon';

type SvgIconProps = React.ComponentProps<typeof SvgIcon>;

import {BreadCrumbIconWrapper} from './styles';
import {BreadcrumbDetails} from '../breadcrumbs/types';

type Props = Omit<BreadcrumbDetails, 'description'> & Pick<SvgIconProps, 'size'>;

const BreadcrumbIcon = ({icon, color, borderColor, size}: Props) => {
  const Icon = icon as React.ComponentType<SvgIconProps>;
  return (
    <BreadCrumbIconWrapper color={color} borderColor={borderColor}>
      <Icon size={size} />
    </BreadCrumbIconWrapper>
  );
};

export default BreadcrumbIcon;
