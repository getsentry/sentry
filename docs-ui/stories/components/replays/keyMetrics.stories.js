import {KeyMetricData, KeyMetrics} from 'sentry/components/replays/keyMetrics';

export default {
  title: 'Components/Replays/KeyMetrics',
  component: KeyMetrics,
};

const Template = () => (
  <KeyMetrics>
    <KeyMetricData keyName="Timestamp" value="17h ago" />
    <KeyMetricData keyName="Duration" value="2m 50s" />
    <KeyMetricData keyName="Errors" value="2" />
  </KeyMetrics>
);

export const _ReplayController = Template.bind({});
_ReplayController.parameters = {
  docs: {
    description: {
      story:
        'ReplayController is a component that contains play/pause buttons for the replay timeline',
    },
  },
};
