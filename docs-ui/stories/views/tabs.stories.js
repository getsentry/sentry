import styled from '@emotion/styled';

import {Item, TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import space from 'sentry/styles/space';

export default {
  title: 'Views/Tabs',
  component: Tabs,
};

export const Default = args => {
  return (
    <Tabs {...args}>
      <TabList>
        <Item key="details">Details</Item>
        <Item key="activity">Activity</Item>
        <Item key="user-feedback">User Feedback</Item>
        <Item key="attachments">Attachments</Item>
        <Item key="tags">Tags</Item>
        <Item key="disabled" disabled>
          Disabled Tab
        </Item>
      </TabList>
      <StyledTabPanels>
        <Item key="details">So by colonel hearted ferrars.</Item>
        <Item key="activity">Draw from upon here gone add one.</Item>
        <Item key="user-feedback">
          He in sportsman household otherwise it perceived instantly.
        </Item>
        <Item key="attachments">Do play they miss give so up.</Item>
        <Item key="tags">Words to up style of since world.</Item>
        <Item key="disabled">Unreachable content</Item>
      </StyledTabPanels>
    </Tabs>
  );
};

Default.storyName = 'Default';
Default.args = {orientation: 'horizontal', disabled: false};
Default.argTypes = {
  orientation: {
    options: ['horizontal', 'vertical'],
    control: {type: 'radio'},
  },
  className: {control: {type: 'disabed'}},
};

// To add styles to tab panels, wrap styled() around `TabPanels`, not `Item`
const StyledTabPanels = styled(TabPanels)`
  color: ${p => p.theme.subText};
`;
