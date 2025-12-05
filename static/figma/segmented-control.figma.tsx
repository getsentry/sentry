import figma from '@figma/code-connect';

import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {figmaNodeUrl} from './utils';

figma.connect(SegmentedControl, figmaNodeUrl('6699-6559'), {
  props: {
    size: figma.enum('Size', {
      MD: 'md',
      SM: 'sm',
      XS: 'xs',
      // Zero exists in Figma but not in SegmentedControl
    }),
    priority: figma.enum('Priority', {
      Default: 'default',
      Primary: 'primary',
    }),
    // Core SegmentedControl props not in Figma:
    // value: Value (selected segment value)
    // onChange: (value: Value) => void (callback)
    // children: CollectionChildren<Value> (segment items)
    // disabled: boolean (no global disabled in Figma, individual items can be disabled)
    // Individual segment item props not at group level:
    // icon, tooltip, tooltipOptions (configured per SegmentedControl.Item)
  },
  example: props => (
    <SegmentedControl
      size={props.size}
      priority={props.priority}
      value="option1"
      onChange={() => {}}
    >
      <SegmentedControl.Item key="option1">Option 1</SegmentedControl.Item>
      <SegmentedControl.Item key="option2">Option 2</SegmentedControl.Item>
      <SegmentedControl.Item key="option3">Option 3</SegmentedControl.Item>
    </SegmentedControl>
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/segmentedcontrol',
    },
  ],
});
