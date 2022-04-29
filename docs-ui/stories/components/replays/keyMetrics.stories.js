import {KeyMetricData, KeyMetrics} from 'sentry/components/replays/keyMetrics';

export default {
  title: 'Components/Replays/KeyMetrics',
  component: KeyMetrics,
};

export const Default = () => (
  <KeyMetrics>
    <KeyMetricData keyName="Timestamp" value="9 hours ago" />
    <KeyMetricData keyName="Duration" value="1min 52s" />
    <KeyMetricData keyName="Errors" value="2" />
  </KeyMetrics>
);
Default.storyName = 'default';
