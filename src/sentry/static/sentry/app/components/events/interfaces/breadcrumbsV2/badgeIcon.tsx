import React from 'react';

import SvgIcon from 'app/icons/svgIcon';
import Tooltip from 'app/components/tooltip';

import {BreadcrumbsWithDetails} from './types';
import Badge from './badge';

type SvgIconProps = React.ComponentProps<typeof SvgIcon>;

type Props = Pick<
  BreadcrumbsWithDetails[0],
  'icon' | 'description' | 'color' | 'borderColor'
>;

const BadgeIcon = ({icon, description, color, borderColor}: Props) => {
  const Icon = icon as React.ComponentType<SvgIconProps>;
  return (
    <Tooltip title={description}>
      <Badge color={color} borderColor={borderColor}>
        <Icon />
      </Badge>
    </Tooltip>
  );
};

export default BadgeIcon;
