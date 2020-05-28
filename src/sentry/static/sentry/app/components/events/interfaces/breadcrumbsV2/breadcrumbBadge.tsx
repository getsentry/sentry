import React from 'react';

import Tooltip from 'app/components/tooltip';
import {tct} from 'app/locale';
import SvgIcon from 'app/icons/svgIcon';

import {BreadcrumbsWithDetails} from './types';
import Badge from './badge';

type SvgIconProps = React.ComponentProps<typeof SvgIcon>;

type Props = {
  breadcrumb: BreadcrumbsWithDetails[0];
};

const BreadcrumbBadge = ({
  breadcrumb: {breadcrumbs, color, borderColor, description, icon},
}: Props) => {
  if (!breadcrumbs || breadcrumbs.length === 0) {
    const Icon = icon as React.ComponentType<SvgIconProps>;
    return (
      <Tooltip title={description}>
        <Badge color={color} borderColor={borderColor}>
          <Icon />
        </Badge>
      </Tooltip>
    );
  }

  const getCollapsedCrumbTootipTitle = () => {
    const collapsedQuantity = breadcrumbs.length;

    if (collapsedQuantity > 1) {
      return tct('[collapsedQuantity] breadcrumbs of the same type are collapsed', {
        collapsedQuantity,
      });
    }

    return tct('[collapsedQuantity] breadcrumb of the same type is collapsed', {
      collapsedQuantity,
    });
  };

  return (
    <Tooltip title={getCollapsedCrumbTootipTitle()}>
      <Badge color={color} isNumeric>
        {breadcrumbs.length}
      </Badge>
    </Tooltip>
  );
};

export default BreadcrumbBadge;
