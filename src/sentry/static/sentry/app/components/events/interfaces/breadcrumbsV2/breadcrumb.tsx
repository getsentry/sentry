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
import {BreadcrumbsWithDetails, BreadcrumbType} from './types';

const MAX_BREADCRUMB_QUANTITY = 10;

type Props = {
  breadcrumb: BreadcrumbsWithDetails[0];
  event: Event;
  orgId: string | null;
  isLastItem?: boolean;
};

type State = {
  breadcrumbs: BreadcrumbsWithDetails;
  showCollapsedQuantity: number;
};

class Breadcrumb extends React.Component<Props, State> {
  state: State = {
    breadcrumbs: this.props.breadcrumb?.breadcrumbs || [],
    showCollapsedQuantity: this.props.breadcrumb?.breadcrumbs?.length || 0,
  };

  handleClick = () => {
    console.log('here');
    this.setState({
      showCollapsedQuantity:
        this.state.showCollapsedQuantity >= this.state.breadcrumbs.length
          ? this.state.showCollapsedQuantity
          : this.state.showCollapsedQuantity + 1,
    });
  };

  render() {
    const {breadcrumb, orgId, event, ...rest} = this.props;

    const crumbProps = {
      ...rest,
      hasError: breadcrumb.type === BreadcrumbType.ERROR,
      // onClick: breadcrumb?.breadcrumbs ? this.handleClick : undefined,
    };

    console.log('props', breadcrumb, 'state', this.state.breadcrumbs);

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
        {/* {this.state.breadcrumbs
          .slice(0, this.state.showCollapsedQuantity)
          .map((crumb, idx) => (
            <Breadcrumb key={idx} breadcrumb={crumb} event={event} orgId={orgId} />
          ))} */}
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
