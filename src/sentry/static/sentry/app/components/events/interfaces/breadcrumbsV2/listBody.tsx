import React from 'react';
import styled from '@emotion/styled';

import {Event} from 'app/types';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

import Time from './time/time';
import Data from './data/data';
import Category from './category';
import Icon from './icon';
import Level from './level';
import {GridCell, GridCellLeft} from './styles';
import {Breadcrumb, BreadcrumbsWithDetails, BreadcrumbType} from './types';

type Props = {
  breadcrumbs: BreadcrumbsWithDetails;
  event: Event;
  orgId: string | null;
  relativeTime?: string;
  displayRelativeTime?: boolean;
};

const ListBody = React.memo(
  ({orgId, event, breadcrumbs, relativeTime, displayRelativeTime}: Props) => (
    <React.Fragment>
      {breadcrumbs.map(({color, icon, id, ...crumb}, idx) => {
        const hasError = crumb.type === BreadcrumbType.ERROR;
        const isLastItem = breadcrumbs.length - 1 === idx;

        return (
          <React.Fragment key={id}>
            <GridCellLeft hasError={hasError} isLastItem={isLastItem}>
              <Tooltip title={crumb.description}>
                <Icon icon={icon} color={color} />
              </Tooltip>
            </GridCellLeft>
            <GridCellCategory hasError={hasError} isLastItem={isLastItem}>
              <Category category={crumb?.category} />
            </GridCellCategory>
            <GridCell hasError={hasError} isLastItem={isLastItem}>
              <Data event={event} orgId={orgId} breadcrumb={crumb as Breadcrumb} />
            </GridCell>
            <GridCell hasError={hasError} isLastItem={isLastItem}>
              <Level level={crumb.level} />
            </GridCell>
            <GridCell hasError={hasError} isLastItem={isLastItem}>
              <Time
                timestamp={crumb?.timestamp}
                relativeTime={relativeTime}
                displayRelativeTime={displayRelativeTime}
              />
            </GridCell>
          </React.Fragment>
        );
      })}
    </React.Fragment>
  )
);

export default ListBody;

const GridCellCategory = styled(GridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;
