import styled from '@emotion/styled';

import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {EntryType} from 'sentry/types/event';

// TODO these two sets of example data are not from the same replay!
import breadcrumbs from './example_breadcrumbs.json';
import rrwebEvents1 from './example_rrweb_events_1.json';

export default {
  title: 'Components/Replays/ReplayTimeline',
  component: ReplayTimeline,
};

const ManualResize = styled('div')`
  resize: both;
  overflow: auto;
  border: 1px solid ${p => p.theme.gray100};
`;

const Template = ({...args}) => (
  <ReplayContextProvider value={{duration: 25710}} events={rrwebEvents1}>
    <ManualResize>
      <ReplayTimeline {...args} />
    </ManualResize>
  </ReplayContextProvider>
);

export const _ReplayTimeline = Template.bind({});
_ReplayTimeline.args = {
  data: breadcrumbs,
  type: EntryType.BREADCRUMBS,
};
_ReplayTimeline.parameters = {
  docs: {
    description: {
      story:
        'ReplayTimeline is a component that contains play/pause buttons for the replay timeline',
    },
  },
};
