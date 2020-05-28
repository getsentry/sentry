import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {Event} from 'app/types';
import SentryTypes from 'app/sentryTypes';

import {Grid} from './styles';
import {BreadcrumbsWithDetails} from './types';
import Breadcrumb from './breadcrumb';
import TopCollapsedInfo from './topCollapsedInfo';

type Props = {
  breadcrumbs: BreadcrumbsWithDetails;
  collapsedQuantity: number;
  onToggleCollapse: () => void;
  event: Event;
  orgId: string | null;
  maxHeight?: React.CSSProperties['maxHeight'];
};

const ListBody = React.forwardRef<HTMLDivElement, Props>(function ListBody(
  {orgId, event, maxHeight, breadcrumbs, collapsedQuantity, onToggleCollapse},
  ref
) {
  return (
    <StyledGrid maxHeight={maxHeight} ref={ref}>
      {collapsedQuantity > 0 && (
        <TopCollapsedInfo onClick={onToggleCollapse} quantity={collapsedQuantity} />
      )}
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
  collapsedQuantity: PropTypes.number.isRequired,
  onToggleCollapse: PropTypes.func.isRequired,
  event: SentryTypes.Event.isRequired,
  orgId: PropTypes.string.isRequired,
  maxHeight: PropTypes.string,
};

const StyledGrid = styled(Grid)`
  border-radius: ${p => p.theme.borderRadiusBottom};
  border-top: 0;
`;
