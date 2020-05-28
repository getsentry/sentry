import React from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Event} from 'app/types';
import space from 'app/styles/space';
import {tct} from 'app/locale';

import Time from './time';
import Data from './data/data';
import Category from './category';
import Level from './level';
import BadgeIcon from './badgeIcon';
import BadgeCollapsed from './badgeCollapsed';
import {GridCell, GridCellLeft} from './styles';
import {BreadcrumbsWithDetails, BreadcrumbType} from './types';

const MAX_BREADCRUMB_QUANTITY = 9;

type Props = {
  breadcrumb: BreadcrumbsWithDetails[0];
  event: Event;
  orgId: string | null;
  isLastItem?: boolean;
};

type State = {
  breadcrumbs: BreadcrumbsWithDetails;
  showCollapsedQtd: number;
};

class Breadcrumb extends React.Component<Props, State> {
  state: State = {
    breadcrumbs: this.props.breadcrumb?.breadcrumbs
      ? [omit(this.props.breadcrumb, 'breadcrumbs'), ...this.props.breadcrumb.breadcrumbs]
      : ([omit(this.props.breadcrumb, 'breadcrumbs')] as any),
    showCollapsedQtd: 0,
  };

  handleExpand = () => {
    this.setState({
      showCollapsedQtd:
        this.state.showCollapsedQtd >= this.state.breadcrumbs.length - 1
          ? this.state.showCollapsedQtd
          : this.state.showCollapsedQtd + MAX_BREADCRUMB_QUANTITY,
    });
  };

  handleCollapse = () => {
    this.setState({
      showCollapsedQtd: 0,
    });
  };

  render() {
    const {breadcrumb, orgId, event, ...rest} = this.props;
    const {showCollapsedQtd, breadcrumbs} = this.state;
    const {
      color,
      icon,
      description,
      borderColor,
      type,
      category,
      level,
      timestamp,
    } = breadcrumb;

    const showBreadcrumbs = breadcrumbs.slice(0, showCollapsedQtd);
    const isFullyExpanded = showBreadcrumbs.length === this.state.breadcrumbs.length;

    const crumbProps = {
      ...rest,
      hasError: type === BreadcrumbType.ERROR,
      onClick:
        breadcrumbs.length > 1
          ? isFullyExpanded
            ? this.handleCollapse
            : this.handleExpand
          : undefined,
    };

    return (
      <React.Fragment>
        <GridCellLeft {...crumbProps}>
          {breadcrumbs.length > 1 ? (
            <BadgeCollapsed
              crumbsQuantity={
                isFullyExpanded
                  ? showBreadcrumbs.length
                  : breadcrumbs.length - showBreadcrumbs.length
              }
              color={color}
              isFullyExpanded={isFullyExpanded}
            />
          ) : (
            <BadgeIcon
              color={color}
              borderColor={borderColor}
              icon={icon}
              description={description}
            />
          )}
        </GridCellLeft>
        <GridCellCategory {...crumbProps}>
          <Category category={category} />
        </GridCellCategory>
        <GridCell {...crumbProps}>
          {breadcrumbs.length > 1 ? (
            isFullyExpanded ? (
              tct('[quantity] Expanded Crumbs', {
                quantity: showBreadcrumbs.length,
              })
            ) : showCollapsedQtd >= MAX_BREADCRUMB_QUANTITY ? (
              tct('[quantity] More Similar Crumbs', {
                quantity: breadcrumbs.length - showCollapsedQtd,
              })
            ) : (
              tct('[quantity] Collapsed Crumbs', {
                quantity: breadcrumbs.length - showCollapsedQtd,
              })
            )
          ) : (
            <Data event={event} orgId={orgId} breadcrumb={breadcrumb} />
          )}
        </GridCell>
        <GridCell {...crumbProps}>
          <Level level={level} />
        </GridCell>
        <GridCell {...crumbProps}>
          <Time timestamp={timestamp} />
        </GridCell>
        {showBreadcrumbs.map((crumb, idx) => (
          <Breadcrumb key={idx} breadcrumb={crumb} event={event} orgId={orgId} />
        ))}
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
