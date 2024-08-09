import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import type {Node} from '@react-types/shared';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import type {DraggableTabListItemProps} from 'sentry/components/draggableTabs/item';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {defined} from 'sentry/utils';
import {
  DraggableTabBar,
  type Tab,
} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabBar';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

const TabPanelContainer = styled('div')`
  width: 90%;
  height: 250px;
  background-color: white;
`;

const TABS: Tab[] = [
  {
    key: 'one',
    label: 'Inbox',
    content: <TabPanelContainer>This is the Inbox view</TabPanelContainer>,
    query: '',
    querySort: IssueSortOptions.DATE,
    queryCount: 1001,
    unsavedChanges: ['a', IssueSortOptions.DATE],
  },
  {
    key: 'two',
    label: 'For Review',
    content: <TabPanelContainer>This is the For Review view</TabPanelContainer>,
    query: '',
    querySort: IssueSortOptions.DATE,
    queryCount: 50,
  },
  {
    key: 'three',
    label: 'Regressed',
    content: <TabPanelContainer>This is the Regressed view</TabPanelContainer>,
    query: '',
    querySort: IssueSortOptions.DATE,
    queryCount: 100,
  },
];

export default storyBook(DraggableTabBar, story => {
  story('Default', () => {
    const [showTempTab, setShowTempTab] = useState(false);
    const [tabs, setTabs] = useState(TABS);
    const [selectedTabKey, setSelectedTabKey] = useState('one');

    const tempTab = {
      key: 'temporary-tab',
      label: 'Unsaved',
      query: '',
      querySort: IssueSortOptions.DATE,
      queryCount: 100,
      content: <TabPanelContainer>This is the Temporary view</TabPanelContainer>,
    };
    const onReorder = (newOrder: Node<DraggableTabListItemProps>[]) => {
      const newDraggableTabs = newOrder
        .map(node => {
          const foundTab = tabs.find(tab => tab.key === node.key);
          return foundTab?.key === node.key ? foundTab : null;
        })
        .filter(defined);

      setTabs(newDraggableTabs);
    };

    return (
      <Fragment>
        <Alert type="warning">This component is still a work in progress.</Alert>
        <p>
          You should be using all of <JSXNode name="Tabs" />, <JSXNode name="TabList" />,{' '}
          <JSXNode name="TabList.Item" />, <JSXNode name="DroppableTabPanels" /> and
          <JSXNode name="DroppableTabPanels.Item" /> components.
        </p>
        <p>
          This will give you all kinds of accessibility and state tracking out of the box.
          But you will have to render all tab content, including hooks, upfront.
        </p>
        <SizingWindow style={{flexDirection: 'column', alignItems: 'flex-start'}}>
          <StyledButton onClick={() => setShowTempTab(!showTempTab)}>
            Toggle Temporary View
          </StyledButton>
          <TabBarContainer>
            <DraggableTabBar
              selectedTabKey={selectedTabKey}
              setSelectedTabKey={setSelectedTabKey}
              tabs={tabs}
              setTabs={setTabs}
              showTempTab={showTempTab}
              tempTabContent={
                <TabPanelContainer>This is a Temporary view</TabPanelContainer>
              }
              onReorder={onReorder}
              tempTab={tempTab}
              onDiscardTempView={() => {
                setShowTempTab(false);
              }}
            />
          </TabBarContainer>
        </SizingWindow>
      </Fragment>
    );
  });
});

const StyledButton = styled(Button)`
  justify-content: start;
  margin-bottom: 5px;
`;

const TabBarContainer = styled('div')`
  display: flex;
  justify-content: start;
  width: 90%;
  height: 300px;
`;
