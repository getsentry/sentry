import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DraggableTabBar} from 'sentry/components/draggableTabs';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(DraggableTabBar, story => {
  const TABS = [
    {key: 'one', label: 'Inbox', content: 'This is the Inbox view.'},
    {key: 'two', label: 'For Review', content: 'This is the For Review view'},
    {key: 'three', label: 'Regressed', content: 'This is the Regressed view'},
  ];

  story('Default', () => (
    <Fragment>
      <p>
        You should be using all of <JSXNode name="Tabs" />, <JSXNode name="TabList" />,{' '}
        <JSXNode name="TabList.Item" />, <JSXNode name="DroppableTabPanels" /> and
        <JSXNode name="DroppableTabPanels.Item" /> components.
      </p>
      <p>
        This will give you all kinds of accessibility and state tracking out of the box.
        But you will have to render all tab content, including hooks, upfront.
      </p>
      <SizingWindow>
        <TabBarContainer>
          <DraggableTabBar tabs={TABS} />
        </TabBarContainer>
      </SizingWindow>
    </Fragment>
  ));
});

const TabBarContainer = styled('div')`
  display: flex;
  justify-content: start;
  width: 90%;
  height: 300px;
`;
