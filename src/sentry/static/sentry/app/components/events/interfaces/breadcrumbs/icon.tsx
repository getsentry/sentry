import * as React from 'react';

import SvgIcon from 'app/icons/svgIcon';

type SvgIconProps = React.ComponentProps<typeof SvgIcon>;

import {IconWrapper} from './styles';
import {BreadcrumbsWithDetails} from './types';

type Props = Pick<BreadcrumbsWithDetails[0], 'color' | 'icon'> &
  Pick<SvgIconProps, 'size'>;

const Icon = React.memo(({icon, color, size}: Props) => {
  const Svg = icon as React.ComponentType<SvgIconProps>;
  return (
    <IconWrapper color={color}>
      <Svg size={size} />
    </IconWrapper>
  );
});

export default Icon;
