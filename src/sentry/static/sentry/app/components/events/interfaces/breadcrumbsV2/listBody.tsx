import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {Event} from 'app/types';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import SentryTypes from 'app/sentryTypes';

import Time from './time';
import Data from './data/data';
import Category from './category';
import Icon from './icon';
import Level from './level';
import {Grid, GridCell, GridCellLeft} from './styles';
import {Breadcrumb, BreadcrumbsWithDetails, BreadcrumbType} from './types';

type Props = {
  breadcrumbs: BreadcrumbsWithDetails;
  event: Event;
  orgId: string | null;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  maxHeight?: React.CSSProperties['maxHeight'];
};

const ListBody = React.forwardRef<HTMLDivElement, Props>(function ListBody(
  {orgId, event, maxHeight, breadcrumbs, onScroll},
  ref
) {
  return (
    <StyledGrid maxHeight={maxHeight} ref={ref} onScroll={onScroll}>
      {breadcrumbs.map(({color, icon, ...crumb}, idx) => {
        const hasError = crumb.type === BreadcrumbType.ERROR;
        const isLastItem = breadcrumbs.length - 1 === idx;
        return (
          <React.Fragment key={idx}>
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
              <Time timestamp={crumb.timestamp} />
            </GridCell>
          </React.Fragment>
        );
      })}
    </StyledGrid>
  );
});

export default ListBody;

ListBody.propTypes = {
  breadcrumbs: PropTypes.array.isRequired,
  event: SentryTypes.Event.isRequired,
  orgId: PropTypes.string.isRequired,
  onScroll: PropTypes.func.isRequired,
  maxHeight: PropTypes.string,
};

const GridCellCategory = styled(GridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;

const StyledGrid = styled(Grid)`
  border-radius: ${p => p.theme.borderRadiusBottom};
  border-top: 0;
`;
