import 'intersection-observer'; // polyfill

import {useState} from 'react';
import styled from '@emotion/styled';
import type {Key, Node} from '@react-types/shared';

import Badge from 'sentry/components/badge/badge';
import {DraggableTabList} from 'sentry/components/draggableTabs/draggableTabList';
import type {DraggableTabListItemProps} from 'sentry/components/draggableTabs/item';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import QueryCount from 'sentry/components/queryCount';
import {TabPanels, Tabs} from 'sentry/components/tabs';
import {space} from 'sentry/styles/space';
import {DraggableTabMenuButton} from 'sentry/views/issueList/draggableTabMenuButton';

export interface Tab {
  content: React.ReactNode;
  key: Key;
  label: string;
  hasUnsavedChanges?: boolean;
  onDelete?: (key: MenuItemProps['key']) => void;
  onDiscard?: (key: MenuItemProps['key']) => void;
  onDuplicate?: (key: MenuItemProps['key']) => void;
  onRename?: (key: MenuItemProps['key']) => void;
  onSave?: (key: MenuItemProps['key']) => void;
  queryCount?: number;
}

export interface DraggableTabBarProps {
  tabs: Tab[];
  tempTabContent: React.ReactNode;
}

export function DraggableTabBar(props: DraggableTabBarProps) {
  const [tabs, setTabs] = useState<Tab[]>(props.tabs);
  const [selectedTabKey, setSelectedTabKey] = useState<Key>(props.tabs[0].key);

  const onReorder: (newOrder: Node<DraggableTabListItemProps>[]) => void = newOrder => {
    let newTabOrder: Tab[] = [];
    for (const node of newOrder) {
      const foundTab = tabs.find(tab => tab.key === node.key);
      if (foundTab) {
        newTabOrder = [...newTabOrder, foundTab];
      }
    }
    setTabs(newTabOrder);
  };

  return (
    <Tabs>
      <DraggableTabList
        onReorder={onReorder}
        onSelectionChange={setSelectedTabKey}
        orientation="horizontal"
      >
        {tabs.map(tab => (
          <DraggableTabList.Item key={tab.key}>
            {tab.label}
            <StyledBadge>
              <QueryCount hideParens count={tab.queryCount} max={1000} />
            </StyledBadge>
            {selectedTabKey === tab.key && (
              <DraggableTabMenuButton
                hasUnsavedChanges={tab.hasUnsavedChanges}
                onDelete={tab.onDelete}
                onDiscard={tab.onDiscard}
                onDuplicate={tab.onDuplicate}
                onRename={tab.onRename}
                onSave={tab.onSave}
              />
            )}
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

const StyledBadge = styled(Badge)`
  display: flex;
  height: 16px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: transparent;
  border: 1px solid ${p => p.theme.gray200};
  color: ${p => p.theme.gray300};
  margin-left: ${space(0)};
`;
