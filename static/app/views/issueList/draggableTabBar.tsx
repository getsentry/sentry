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
import {defined} from 'sentry/utils';
import {DraggableTabMenuButton} from 'sentry/views/issueList/draggableTabMenuButton';

export interface Tab {
  content: React.ReactNode;
  key: Key;
  label: string;
  hasUnsavedChanges?: boolean;
  queryCount?: number;
}

export interface DraggableTabBarProps {
  tabs: Tab[];
  onDelete?: (key: MenuItemProps['key']) => void;
  onDiscard?: (key: MenuItemProps['key']) => void;
  onDuplicate?: (key: MenuItemProps['key']) => void;
  onRename?: (key: MenuItemProps['key']) => void;
  onSave?: (key: MenuItemProps['key']) => void;
}

export function DraggableTabBar(props: DraggableTabBarProps) {
  const [tabs, setTabs] = useState<Tab[]>(props.tabs);
  const [selectedTabKey, setSelectedTabKey] = useState<Key>(props.tabs[0].key);

  const onReorder: (newOrder: Node<DraggableTabListItemProps>[]) => void = newOrder => {
    setTabs(
      newOrder
        .map(node => {
          const foundTab = tabs.find(tab => tab.key === node.key);
          return foundTab?.key === node.key ? foundTab : null;
        })
        .filter(defined)
    );
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
            <TabContentWrap>
              {tab.label}
              <StyledBadge>
                <QueryCount hideParens count={tab.queryCount} max={1000} />
              </StyledBadge>
              {selectedTabKey === tab.key && (
                <DraggableTabMenuButton
                  hasUnsavedChanges={tab.hasUnsavedChanges}
                  onDelete={key => props.onDelete?.(key)}
                  onDiscard={key => props.onDiscard?.(key)}
                  onDuplicate={key => props.onDuplicate?.(key)}
                  onRename={key => props.onRename?.(key)}
                  onSave={key => props.onSave?.(key)}
                />
              )}
            </TabContentWrap>
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

const TabContentWrap = styled('span')`
  white-space: nowrap;
  display: flex;
  align-items: center;
  flex-direction: row;
  padding: ${space(0)} ${space(0)};
  gap: 6px;
`;

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
