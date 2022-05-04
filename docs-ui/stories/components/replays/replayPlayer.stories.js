import styled from '@emotion/styled';

import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';

import events from './example_rrweb_events_1.json';

export default {
  title: 'Components/Replays/ReplayPlayer',
  component: ReplayPlayer,
};

const ManualResize = styled('div')`
  resize: both;
  overflow: auto;
  width: 50%;
`;

export const ScaledReplayPlayer = () => (
  <ReplayContextProvider events={events}>
    <ManualResize>
      <ReplayPlayer />
    </ManualResize>
  </ReplayContextProvider>
);

export const FastForwardingReplayPlayer = () => (
  <ReplayContextProvider value={{fastForwardSpeed: 4}} events={events}>
    <ManualResize>
      <ReplayPlayer />
    </ManualResize>
  </ReplayContextProvider>
);

export const BufferingReplayPlayer = () => (
  <ReplayContextProvider value={{isBuffering: true}} events={events}>
    <ManualResize>
      <ReplayPlayer />
    </ManualResize>
  </ReplayContextProvider>
);
