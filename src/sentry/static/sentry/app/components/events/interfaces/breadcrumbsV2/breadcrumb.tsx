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
  render() {
    const {breadcrumb, orgId, event, isLastItem, hasError} = this.props;
    return (
      <React.Fragment>
        <GridCellLeft hasError={hasError} isLastItem={isLastItem}>
          <BreadcrumbBadge breadcrumb={breadcrumb} />
        </GridCellLeft>
        <GridCellCategory hasError={hasError} isLastItem={isLastItem}>
          <Category category={breadcrumb?.category} />
        </GridCellCategory>
        <GridCell hasError={hasError} isLastItem={isLastItem}>
          <Data event={event} orgId={orgId} breadcrumb={breadcrumb} />
        </GridCell>
        <GridCell hasError={hasError} isLastItem={isLastItem}>
          <Level level={breadcrumb.level} />
        </GridCell>
        <GridCell hasError={hasError} isLastItem={isLastItem}>
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
