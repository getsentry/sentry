import React from 'react';
import styled from '@emotion/styled';

import {Event} from 'app/types';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

import Time from './time';
import Data from './data';
import Category from './category';
import Icon from './icon';
import Level from './level';
import {GridCell, GridCellLeft} from './styles';
import {BreadcrumbsWithDetails, BreadcrumbType} from './types';

type Props = {
  breadcrumb: BreadcrumbsWithDetails[0];
  event: Event;
  orgId: string | null;
  searchTerm: string;
  isLastItem: boolean;
  relativeTime: string;
  displayRelativeTime: boolean;
};

const ListBody = React.memo(
  ({
    orgId,
    event,
    breadcrumb,
    relativeTime,
    displayRelativeTime,
    searchTerm,
    isLastItem,
  }: Props) => {
    const hasError = breadcrumb.type === BreadcrumbType.ERROR;

    return (
      <React.Fragment>
        <GridCellLeft hasError={hasError} isLastItem={isLastItem}>
          <Tooltip title={breadcrumb.description}>
            <Icon icon={breadcrumb.icon} color={breadcrumb.color} />
          </Tooltip>
        </GridCellLeft>
        <GridCellCategory hasError={hasError} isLastItem={isLastItem}>
          <Category category={breadcrumb?.category} searchTerm={searchTerm} />
        </GridCellCategory>
        <GridCell hasError={hasError} isLastItem={isLastItem}>
          <Data
            event={event}
            orgId={orgId}
            breadcrumb={breadcrumb}
            searchTerm={searchTerm}
          />
        </GridCell>
        <GridCell hasError={hasError} isLastItem={isLastItem}>
          <Level level={breadcrumb.level} searchTerm={searchTerm} />
        </GridCell>
        <GridCell hasError={hasError} isLastItem={isLastItem}>
          <Time
            timestamp={breadcrumb?.timestamp}
            relativeTime={relativeTime}
            displayRelativeTime={displayRelativeTime}
            searchTerm={searchTerm}
          />
        </GridCell>
      </React.Fragment>
    );
  }
);

export default ListBody;

const GridCellCategory = styled(GridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;
