import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {Event} from 'app/types';
import SentryTypes from 'app/sentryTypes';

import {Grid} from './styles';
import {BreadcrumbsWithDetails} from './types';
import Breadcrumb from './breadcrumb';

type Props = {
  breadcrumbs: BreadcrumbsWithDetails;
  event: Event;
  orgId: string | null;
  maxHeight?: React.CSSProperties['maxHeight'];
};

const ListBody = React.forwardRef<HTMLDivElement, Props>(function ListBody(
  {orgId, event, maxHeight, breadcrumbs},
  ref
) {
  return (
    <StyledGrid maxHeight={maxHeight} ref={ref}>
      {breadcrumbs.map((breadcrumb, idx) => {
        const isLastItem = breadcrumbs.length - 1 === idx;
        return (
          <Breadcrumb
            key={idx}
            breadcrumb={breadcrumb}
            orgId={orgId}
            event={event}
            isLastItem={isLastItem}
          />
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
  maxHeight: PropTypes.string,
};

const StyledGrid = styled(Grid)`
  border-radius: ${p => p.theme.borderRadiusBottom};
  border-top: 0;
`;
