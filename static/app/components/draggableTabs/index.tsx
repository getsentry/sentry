import 'intersection-observer'; // polyfill

import {useEffect, useState} from 'react';
import type {Key} from '@react-types/shared';

import {DraggableTabList} from 'sentry/components/draggableTabs/draggableTabList';
import {TabPanels, Tabs} from 'sentry/components/tabs';

export interface Tab {
  content: React.ReactNode;
  key: Key;
  label: string;
}

export interface DragAndDropTabBarProps {
  tabs: Tab[];
}

export function DraggableTabBar(props: DragAndDropTabBarProps) {
  const [tabs, setTabs] = useState<Tab[]>(props.tabs);

  useEffect(() => {
    setTabs(props.tabs);
  }, [props.tabs]);

  return (
    <Tabs>
      <DraggableTabList tabs={tabs} setTabs={setTabs}>
        {tabs.map(tab => (
          <DraggableTabList.Item key={tab.key}>{tab.label}</DraggableTabList.Item>
        ))}
      </DraggableTabList>
      <TabPanels>
        {tabs.map(tab => (
          <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
        ))}
      </TabPanels>
    </Tabs>
  );
}
