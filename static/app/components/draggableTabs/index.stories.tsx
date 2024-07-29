import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {DraggableTabBar, type Tab} from 'sentry/views/issueList/draggableTabBar';

const TabPanelContainer = styled('div')`
  width: 90%;
  height: 250px;
  background-color: white;
`;

export default storyBook(DraggableTabBar, story => {
  const TABS: Tab[] = [
    {
      key: 'one',
      label: 'Inbox',
      content: <TabPanelContainer>This is the Inbox view</TabPanelContainer>,
      queryCount: 1001,
      hasUnsavedChanges: true,
    },
    {
      key: 'two',
      label: 'For Review',
      content: <TabPanelContainer>This is the For Review view</TabPanelContainer>,
      queryCount: 50,
      hasUnsavedChanges: false,
    },
    {
      key: 'three',
      label: 'Regressed',
      content: <TabPanelContainer>This is the Regressed view</TabPanelContainer>,
      queryCount: 100,
      hasUnsavedChanges: false,
    },
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
