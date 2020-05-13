import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

import BreadcrumbTime from './breadcrumbTime';
import BreadcrumbCollapsed from './breadcrumbCollapsed';
import BreadcrumbData from './breadcrumbData/breadcrumbData';
import BreadcrumbCategory from './breadcrumbCategory';
import BreadcrumbIcon from './breadcrumbIcon';
import BreadcrumbLevel from './breadcrumbLevel';
import {GridCell} from './styles';
import {Breadcrumb, BreadcrumbDetails, BreadcrumbType} from './types';

type Breadcrumbs = Array<Breadcrumb & BreadcrumbDetails & {id: number}>;

type Props = {
  breadcrumbs: Breadcrumbs;
  collapsedQuantity: number;
  onToggleCollapse: () => void;
};

const BreadcrumbsListBody = ({
  breadcrumbs,
  collapsedQuantity,
  onToggleCollapse,
}: Props) => (
  <React.Fragment>
    {collapsedQuantity > 0 && (
      <BreadcrumbCollapsed onClick={onToggleCollapse} quantity={collapsedQuantity} />
    )}
    {breadcrumbs.map(({color, icon, ...crumb}, idx) => {
      const hasError = crumb.type === BreadcrumbType.ERROR;
      return (
        <React.Fragment key={idx}>
          <GridCell hasError={hasError} withoutBorder={['right']} withBeforeContent>
            <Tooltip title={crumb.description}>
              <BreadcrumbIcon icon={icon} color={color} />
            </Tooltip>
          </GridCell>
          <GridCellCategory hasError={hasError} withoutBorder={['left', 'right']}>
            <BreadcrumbCategory category={crumb?.category} />
          </GridCellCategory>
          <GridCell hasError={hasError} withoutBorder={['left', 'right']}>
            <BreadcrumbData breadcrumb={crumb as Breadcrumb} />
          </GridCell>
          <GridCell hasError={hasError} withoutBorder={['left', 'right']}>
            <BreadcrumbLevel level={crumb.level} />
          </GridCell>
          <GridCell hasError={hasError} withoutBorder={['left']}>
            <BreadcrumbTime timestamp={crumb.timestamp} />
          </GridCell>
        </React.Fragment>
      );
    })}
  </React.Fragment>
);

export default BreadcrumbsListBody;

const GridCellCategory = styled(GridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;
