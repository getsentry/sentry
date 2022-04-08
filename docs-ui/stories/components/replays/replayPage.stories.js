import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';

import events from './example_events.json';

export default {
  title: 'Components/Replays/Replay Page',
  component: ReplayPlayer,
};

export const PlayerWithController = () => (
  <ReplayContextProvider events={events}>
    <ReplayPlayer />
    <ReplayController speedOptions={[0.5, 1, 2, 8]} />
  </ReplayContextProvider>
);

export const CustomSpeedOptions = () => (
  <ReplayContextProvider events={events}>
    <ReplayPlayer />
    <ReplayController speedOptions={[1, 8, 16]} />
  </ReplayContextProvider>
);
