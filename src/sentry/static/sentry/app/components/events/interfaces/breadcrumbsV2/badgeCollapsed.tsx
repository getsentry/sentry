import React from 'react';

import {tct} from 'app/locale';
import {IconEllipsis} from 'app/icons';
import Tooltip from 'app/components/tooltip';

import {BreadcrumbsWithDetails} from './types';
import Badge from './badge';

const getCollapsedCrumbTootipTitle = (collapsedQuantity: number) => {
  if (collapsedQuantity > 1) {
    return tct('Show [collapsedQuantity] collapsed crumb', {
      collapsedQuantity,
    });
  }

  return tct('Show [collapsedQuantity] collapsed crumbs', {
    collapsedQuantity,
  });
};

type Props = Required<Pick<BreadcrumbsWithDetails[0], 'color'>> & {
  isFullyExpanded: boolean;
  crumbsQuantity: number;
};

const BadgeCollapsed = ({crumbsQuantity, color, isFullyExpanded}: Props) => {
  if (isFullyExpanded) {
    return (
      <Tooltip title={tct('Hide [crumbsQuantity] expanded crumbs', {crumbsQuantity})}>
        <Badge color="gray800" borderColor="gray400">
          <IconEllipsis />
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={getCollapsedCrumbTootipTitle(crumbsQuantity)}>
      <Badge color={color} isNumeric>
        {crumbsQuantity}
      </Badge>
    </Tooltip>
  );
};

export default BadgeCollapsed;
