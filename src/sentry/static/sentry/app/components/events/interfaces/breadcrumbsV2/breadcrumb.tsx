import React from 'react';
import styled from '@emotion/styled';

import {Event} from 'app/types';
import space from 'app/styles/space';

import Time from './time';
import Data from './data/data';
import Category from './category';
import BreadcrumbBadge from './breadcrumbBadge';
import Level from './level';
import {GridCell, GridCellLeft} from './styles';
import {BreadcrumbsWithDetails} from './types';

type Props = {
  breadcrumb: BreadcrumbsWithDetails[0];
  hasError: boolean;
  isLastItem: boolean;
  event: Event;
  orgId: string | null;
};

class Breadcrumb extends React.Component<Props> {
  handleClick = () => {};
  render() {
    const {breadcrumb, orgId, event, ...rest} = this.props;

    const crumbProps = {
      ...rest,
      onClick: breadcrumb?.breadcrumbs ? this.handleClick : undefined,
    };

    return (
      <React.Fragment>
        <GridCellLeft {...crumbProps}>
          <BreadcrumbBadge breadcrumb={breadcrumb} />
        </GridCellLeft>
        <GridCellCategory {...crumbProps}>
          <Category category={breadcrumb?.category} />
        </GridCellCategory>
        <GridCell {...crumbProps}>
          <Data event={event} orgId={orgId} breadcrumb={breadcrumb} />
        </GridCell>
        <GridCell {...crumbProps}>
          <Level level={breadcrumb.level} />
        </GridCell>
        <GridCell {...crumbProps}>
          <Time timestamp={breadcrumb.timestamp} />
        </GridCell>
      </React.Fragment>
    );
  }
}

export default Breadcrumb;

const GridCellCategory = styled(GridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;
