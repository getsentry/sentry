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
  hasTimeRelativeFormat: boolean;
};

const ListBody = React.forwardRef<HTMLDivElement, Props>(function ListBody(
  {orgId, event, breadcrumbs, hasTimeRelativeFormat},
  ref
) {
  return (
    <StyledGrid ref={ref}>
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
              <Time timestamp={crumb.timestamp} isRelative={hasTimeRelativeFormat} />
            </GridCell>
          </React.Fragment>
        );
      })}
    </StyledGrid>
  );
});

export default React.memo(ListBody) as typeof ListBody;

ListBody.propTypes = {
  breadcrumbs: PropTypes.array.isRequired,
  event: SentryTypes.Event.isRequired,
  orgId: PropTypes.string.isRequired,
  hasTimeRelativeFormat: PropTypes.bool.isRequired,
};

const GridCellCategory = styled(GridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;

const StyledGrid = styled(Grid)`
  border-radius: ${p => p.theme.borderRadiusBottom};
  border-top: 0;
  overflow-y: auto;
  max-height: 450px;
`;
