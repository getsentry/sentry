import {SegmentedControl} from 'sentry/components/segmentedControl';

export default {
  title: 'Components/Segmented Control',
  parameters: {
    controls: {
      size: 'md',
      priority: 'default',
    },
  },
  argTypes: {
    size: {
      options: ['md', 'sm', 'xs'],
      control: {type: 'inline-radio'},
    },
    priority: {
      options: ['default', 'primary'],
      control: {type: 'inline-radio'},
    },
  },
};

export const _SegmentedControl = args => (
  <SegmentedControl {...args} aria-label="Story" defaultValue="1">
    <SegmentedControl.Item key="1">All Issues</SegmentedControl.Item>
    <SegmentedControl.Item key="2">New Issues</SegmentedControl.Item>
    <SegmentedControl.Item key="3">Unhandled</SegmentedControl.Item>
    <SegmentedControl.Item key="4" disabled>
      Disabled
    </SegmentedControl.Item>
  </SegmentedControl>
);
