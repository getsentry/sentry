import 'intersection-observer'; // polyfill

import {useEffect, useState} from 'react';
import type {Key} from '@react-types/shared';

import {DraggableTabList} from 'sentry/components/draggableTabs/draggableTabList';
import {TabPanels, Tabs} from 'sentry/components/tabs';

export interface Tab {
  content: React.ReactNode;
  key: Key;
  label: string;
  queryCount?: number;
}

export interface DragAndDropTabBarProps {
  tabs: Tab[];
  tempTabContent: React.ReactNode;
}

export function DraggableTabBar(props: DragAndDropTabBarProps) {
  const [tabs, setTabs] = useState<Tab[]>([
    ...props.tabs,
    {key: 'temporary-tab', label: 'Unsaved', content: props.tempTabContent},
  ]);

  useEffect(() => {
    setTabs([
      ...props.tabs,
      {key: 'temporary-tab', label: 'Unsaved', content: props.tempTabContent},
    ]);
  }, [props.tabs, props.tempTabContent]);

  return (
    <Tabs>
      <DraggableTabList tabs={tabs} setTabs={setTabs} orientation="horizontal">
        {tabs.map(tab => (
          <DraggableTabList.Item queryCount={tab.queryCount} key={tab.key}>
            {tab.label}
          </DraggableTabList.Item>
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
