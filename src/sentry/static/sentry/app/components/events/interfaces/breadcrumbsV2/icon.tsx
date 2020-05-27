import React from 'react';

import SvgIcon from 'app/icons/svgIcon';

type SvgIconProps = React.ComponentProps<typeof SvgIcon>;

import {IconWrapper} from './styles';
import {BreadcrumbDetails} from './types';

type Props = Omit<BreadcrumbDetails, 'description'> & Pick<SvgIconProps, 'size'>;

const Icon = ({icon, color, size}: Props) => {
  const Svg = icon as React.ComponentType<SvgIconProps>;
  return (
    <IconWrapper color={color}>
      <Svg size={size} />
    </IconWrapper>
  );
};

export {Icon};
