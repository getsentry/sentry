import 'intersection-observer'; // polyfill

import {useState} from 'react';
import type {Key} from '@react-types/shared';

import {DraggableTabList} from 'sentry/components/draggableTabs/draggableTabList';
import {TabPanels, Tabs} from 'sentry/components/tabs';

export interface Tab {
  content: React.ReactNode;
  key: Key;
  label: string;
  hasUnsavedChanges?: boolean;
  queryCount?: number;
}

export interface DraggableTabBarProps {
  tabs: Tab[];
  tempTabContent: React.ReactNode;
}

export function DraggableTabBar(props: DraggableTabBarProps) {
  const [tabs, setTabs] = useState<Tab[]>([...props.tabs]);

  return (
    <Tabs>
      <DraggableTabList tabs={tabs} setTabs={setTabs} orientation="horizontal">
        {tabs.map(tab => (
          <DraggableTabList.Item
            key={tab.key}
            count={tab.queryCount}
            hasUnsavedChanges={tab.hasUnsavedChanges}
          >
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
