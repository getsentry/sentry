import {useState} from 'react';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';

import rrwebEvents1 from './example_rrweb_events_1.json';
import rrwebEvents2 from './example_rrweb_events_2.json';

export default {
  title: 'Components/Replays/Replay Page',
  component: ReplayPlayer,
};

export const PlayerWithController = () => (
  <ReplayContextProvider events={rrwebEvents1}>
    <ReplayPlayer />
    <ReplayController speedOptions={[0.5, 1, 2, 8]} />
  </ReplayContextProvider>
);

export const CustomSpeedOptions = () => (
  <ReplayContextProvider events={rrwebEvents1}>
    <ReplayPlayer />
    <ReplayController speedOptions={[1, 8, 16]} />
  </ReplayContextProvider>
);

export const ChangeEventsInput = () => {
  const [selected, setSelected] = useState('example_1');

  const events = {
    example_1: rrwebEvents1,
    example_2: rrwebEvents2,
  };

  return (
    <ReplayContextProvider events={events[selected]}>
      <SelectControl
        label="Input"
        value={selected}
        onChange={opt => setSelected(opt.value)}
        options={[
          {value: 'example_1', label: 'Example 1'},
          {value: 'example_2', label: 'Example 2'},
        ]}
      />
      <ReplayPlayer />
      <ReplayController speedOptions={[1, 8, 16]} />
    </ReplayContextProvider>
  );
};
