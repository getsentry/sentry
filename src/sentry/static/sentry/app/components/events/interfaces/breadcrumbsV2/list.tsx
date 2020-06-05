import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import ListHeader from './listHeader';
import ListBody from './listBody';
import {aroundContentStyle} from './styles';

type Props = {
  onSwitchTimeFormat: () => void;
} & Omit<React.ComponentProps<typeof ListBody>, 'relativeTime'>;

const List = React.forwardRef(
  (
    {displayRelativeTime, onSwitchTimeFormat, orgId, event, breadcrumbs}: Props,
    ref: React.Ref<HTMLDivElement>
  ) => (
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
