import styled from '@emotion/styled';

import {Item, TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import space from 'sentry/styles/space';

export default {
  title: 'Views/Tabs',
  component: Tabs,
};

const TABS = [
  {key: 'details', label: 'Details', content: 'So by colonel hearted ferrars.'},
  {
    key: 'activity',
    label: 'Activity',
    content: 'Draw from upon here gone add one.',
  },
  {
    key: 'user-feedback',
    label: 'User Feedback',
    content: 'He in sportsman household otherwise it perceived instantly.',
  },
  {
    key: 'attachments',
    label: 'Attachments',
    content: 'Do play they miss give so up.',
  },
  {
    key: 'tags',
    label: 'Tags',
    content: 'Words to up style of since world.',
  },
  {
    key: 'disabled',
    label: 'Disabled',
    content: 'Unreachable content.',
    disabled: true,
  },
];

export const Default = args => {
  return (
    <Tabs {...args}>
      <TabList>
        {TABS.map(tab => (
          <Item key={tab.key} disabled={tab.disabled}>
            {tab.label}
          </Item>
        ))}
      </TabList>
      <StyledTabPanels orientation={args.orientation}>
        {TABS.map(tab => (
          <Item key={tab.key}>{tab.content}</Item>
        ))}
      </StyledTabPanels>
    </Tabs>
  );
};

Default.storyName = 'Default';
Default.args = {
  orientation: 'horizontal',
  disabled: false,
  value: undefined,
  defaultValue: undefined,
};
Default.argTypes = {
  orientation: {
    options: ['horizontal', 'vertical'],
    control: {type: 'radio'},
  },
  value: {
    options: TABS.map(tab => tab.key),
    control: {type: 'select'},
  },
  defaultValue: {
    options: TABS.map(tab => tab.key),
    control: {type: 'select'},
  },
  className: {control: {type: 'disabed'}},
};

const TABS_LINKS = [
  {
    key: 'details',
    label: 'Details',
    content:
      'These tabs act like links. You can command/ctrl/shift-click to open in a new browser tab/window.',
    to: '/?path=/story/views-tabs--tab-links&args=selectedValue:details',
  },
  {
    key: 'activity',
    label: 'Activity',
    content:
      'These tabs act like links. You can command/ctrl/shift-click to open in a new browser tab/window.',
    to: '/?path=/story/views-tabs--tab-links&args=selectedValue:activity',
  },
];

export const TabLinks = ({selectedValue, ...args}) => {
  return (
    <Tabs {...args} value={selectedValue}>
      <TabList>
        {TABS_LINKS.map(tab => (
          <Item key={tab.key} to={tab.to}>
            {tab.label}
          </Item>
        ))}
      </TabList>
      <StyledTabPanels orientation={args.orientation}>
        {TABS_LINKS.map(tab => (
          <Item key={tab.key}>{tab.content}</Item>
        ))}
      </StyledTabPanels>
    </Tabs>
  );
};

TabLinks.storyName = 'Tab Links';
TabLinks.args = Default.args;
TabLinks.argTypes = {
  value: {control: false},
  defaultValue: {control: false},
  selectedValue: {control: false},
};

// To add styles to tab panels, wrap styled() around `TabPanels`, not `Item`
const StyledTabPanels = styled(TabPanels)`
  ${p =>
    p.orientation === 'horizontal'
      ? `padding: ${space(2)} 0;`
      : `padding: 0 ${space(2)};`};

  color: ${p => p.theme.subText};
`;
