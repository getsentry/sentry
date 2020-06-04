import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import ListHeader from './listHeader';
import ListBody from './listBody';
import {aroundContentStyle} from './styles';

type Props = {
  onSwitchTimeFormat: () => void;
} & Omit<React.ComponentProps<typeof ListBody>, 'relativeTime'>;

const List = React.forwardRef<HTMLDivElement, Props>(
  ({displayRelativeTime, onSwitchTimeFormat, orgId, event, breadcrumbs}, ref) => (
    <Grid ref={ref}>
      <ListHeader
        onSwitchTimeFormat={onSwitchTimeFormat}
        displayRelativeTime={!!displayRelativeTime}
      />
      <ListBody
        event={event}
        orgId={orgId}
        breadcrumbs={breadcrumbs}
        relativeTime={breadcrumbs[breadcrumbs.length - 1]?.timestamp}
        displayRelativeTime={!!displayRelativeTime}
      />
    </Grid>
  )
);

export default List;

List.propTypes = {
  displayRelativeTime: PropTypes.bool.isRequired,
  onSwitchTimeFormat: PropTypes.func.isRequired,
  breadcrumbs: PropTypes.array.isRequired,
  event: SentryTypes.Event.isRequired,
  orgId: PropTypes.string.isRequired,
};

const Grid = styled('div')`
  max-height: 500px;
  overflow-y: auto;
  display: grid;
  > *:nth-last-child(5):before {
    bottom: calc(100% - ${space(1)});
  }
  grid-template-columns: max-content minmax(55px, 1fr) 6fr max-content 65px;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: max-content minmax(132px, 1fr) 6fr max-content max-content;
  }
  ${aroundContentStyle}
`;
