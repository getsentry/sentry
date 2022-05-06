import {useState} from 'react';
import styled from '@emotion/styled';
import {action} from '@storybook/addon-actions';

import SelectControl from 'sentry/components/forms/selectControl';
import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import Scrubber from 'sentry/components/replays/player/scrubber';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';

import rrwebEvents1 from './example_rrweb_events_1.json';
import rrwebEvents2 from './example_rrweb_events_2.json';

export default {
  title: 'Components/Replays/Replay Page',
  component: ReplayPlayer,
};

const PanelHeader = styled(_PanelHeader)`
  display: block; /* Override flex */
  padding: 0; /* The disablePadding prop doesn't disable all the padding */
`;

const ManualResize = styled('div')`
  resize: vertical;
  overflow: auto;
  max-width: 100%;

  ${p =>
    p.isFullscreen
      ? `resize: none;
      width: auto !important;
      height: auto !important;
      `
      : ''}
`;

export const PlayerWithController = () => (
  <ReplayContextProvider events={rrwebEvents1}>
    <Panel>
      <PanelHeader>
        <ManualResize isFullscreen={false}>
          <ReplayPlayer />
        </ManualResize>
      </PanelHeader>
      <Scrubber />
      <PanelBody withPadding>
        <ReplayController toggleFullscreen={action('toggleFullscreen')} />
      </PanelBody>
    </Panel>
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
        choices={[
          ['example_1', 'Example 1'],
          ['example_2', 'Example 2'],
        ]}
      />
      <ReplayPlayer />
      <ReplayController speedOptions={[1, 8, 16]} />
    </ReplayContextProvider>
  );
};
