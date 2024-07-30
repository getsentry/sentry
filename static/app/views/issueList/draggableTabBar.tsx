import 'intersection-observer'; // polyfill

import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type {Key, Node} from '@react-types/shared';

import Badge from 'sentry/components/badge/badge';
import {DraggableTabList} from 'sentry/components/draggableTabs/draggableTabList';
import type {DraggableTabListItemProps} from 'sentry/components/draggableTabs/item';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import QueryCount from 'sentry/components/queryCount';
import {TabPanels, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {DraggableTabMenuButton} from 'sentry/views/issueList/draggableTabMenuButton';

export interface Tab {
  content: React.ReactNode;
  key: string;
  label: string;
  hasUnsavedChanges?: boolean;
  queryCount?: number;
}

export interface DraggableTabBarProps {
  defaultNewTab: Tab;
  setTabs: (tabs: Tab[]) => void;
  showTempTab: boolean;
  tabs: Tab[];
  tempTab: Tab;
  onAddView?: React.MouseEventHandler;
  /**
   * Callback function to be called when user clicks the `Delete` button.
   * Note: The `Delete` button only appears for persistent views
   */
  onDelete?: (key: MenuItemProps['key']) => void;
  /**
   * Callback function to be called when user clicks on the `Discard Changes` button.
   * Note: The `Discard Changes` button only appears for persistent views when `isChanged=true`
   */
  onDiscard?: (key: MenuItemProps['key']) => void;
  /**
   * Callback function to be called when user clicks on the `Discard` button for temporary views.
   * Note: The `Discard` button only appears for temporary views
   */
  onDiscardTempView?: () => void;
  /**
   * Callback function to be called when user clicks the 'Duplicate' button.
   * Note: The `Duplicate` button only appears for persistent views
   */
  onDuplicate?: (key: MenuItemProps['key']) => void;
  /**
   * Callback function to be called when user clicks the 'Rename' button.
   * Note: The `Rename` button only appears for persistent views
   */
  onRename?: (key: MenuItemProps['key']) => void;
  /**
   * Callback function to be called when user clicks the 'Save' button.
   * Note: The `Save` button only appears for persistent views when `isChanged=true`
   */
  onSave?: (key: MenuItemProps['key']) => void;
  /**
   * Callback function to be called when user clicks the 'Save View' button for temporary views.
   */
  onSaveTempView?: () => void;
  tempTabContent?: React.ReactNode;
  tempTabLabel?: string;
}

export function DraggableTabBar({
  tabs,
  setTabs,
  tempTab,
  defaultNewTab,
  showTempTab,
  onAddView,
  onDelete,
  onDiscard,
  onDuplicate,
  onRename,
  onSave,
  onDiscardTempView,
  onSaveTempView,
}: DraggableTabBarProps) {
  const [selectedTabKey, setSelectedTabKey] = useState<Key>(tabs[0].key);

  useEffect(() => {
    if (!showTempTab && selectedTabKey === 'temporary-tab') {
      setSelectedTabKey(tabs[0].key);
    }
  }, [showTempTab, selectedTabKey, tabs]);

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

  const handleOnDelete = (tab: Tab) => {
    if (tabs.length > 1) {
      setTabs(tabs.filter(tb => tb.key !== tab.key));
      onDelete?.(tab.key);
    }
  };

  const handleOnDuplicate = (tab: Tab) => {
    const idx = tabs.findIndex(tb => tb.key === tab.key);
    if (idx !== -1) {
      setTabs([
        ...tabs.slice(0, idx + 1),
        {
          ...tab,
          key: `${tab.key}-copy`,
          label: `${tab.label} (Copy)`,
          hasUnsavedChanges: false,
        },
        ...tabs.slice(idx + 1),
      ]);
      onDuplicate?.(tab.key);
    }
  };

  const handleOnAddView = (e: React.MouseEvent<Element, MouseEvent>) => {
    setTabs([...tabs, defaultNewTab]);
    onAddView?.(e);
  };

  const makeMenuOptions = (tab: Tab): MenuItemProps[] => {
    if (tab.key === 'temporary-tab') {
      return makeTempViewMenuOptions({
        onSave: () => onSaveTempView?.(),
        onDiscard: () => onDiscardTempView?.(),
      });
    }
    if (tab.hasUnsavedChanges) {
      return makeUnsavedChangesMenuOptions({
        onRename,
        onDuplicate: () => handleOnDuplicate(tab),
        onDelete: tabs.length > 1 ? () => handleOnDelete(tab) : undefined,
        onSave,
        onDiscard,
      });
    }
    return makeDefaultMenuOptions({
      onRename,
      onDuplicate: () => handleOnDuplicate(tab),
      onDelete: tabs.length > 1 ? () => handleOnDelete(tab) : undefined,
    });
  };

  return (
    <Tabs>
      <DraggableTabList
        onReorder={onReorder}
        onSelectionChange={setSelectedTabKey}
        selectedKey={selectedTabKey}
        showTempTab={showTempTab}
        onAddView={e => handleOnAddView(e)}
        orientation="horizontal"
      >
        {[...tabs, tempTab].map(tab => (
          <DraggableTabList.Item
            textValue={`${tab.label} tab`}
            key={tab.key}
            hidden={tab.key === 'temporary-tab' && !showTempTab}
          >
            <TabContentWrap>
              {tab.label}
              {tab.key !== 'temporary-tab' && tab.queryCount && (
                <StyledBadge>
                  <QueryCount hideParens count={tab.queryCount} max={1000} />
                </StyledBadge>
              )}
              {selectedTabKey === tab.key && (
                <DraggableTabMenuButton
                  hasUnsavedChanges={tab.hasUnsavedChanges}
                  menuOptions={makeMenuOptions(tab)}
                />
              )}
            </TabContentWrap>
          </DraggableTabList.Item>
        ))}
      </DraggableTabList>
      <TabPanels>
        {[...tabs, tempTab].map(tab => (
          <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
        ))}
      </TabPanels>
    </Tabs>
  );
}

const makeDefaultMenuOptions = ({
  onRename,
  onDuplicate,
  onDelete,
}: {
  onDelete?: (key: string) => void;
  onDuplicate?: (key: string) => void;
  onRename?: (key: string) => void;
}): MenuItemProps[] => {
  const menuOptions: MenuItemProps[] = [
    {
      key: 'rename-tab',
      label: t('Rename'),
      onAction: onRename,
    },
    {
      key: 'duplicate-tab',
      label: t('Duplicate'),
      onAction: onDuplicate,
    },
  ];
  if (onDelete) {
    menuOptions.push({
      key: 'delete-tab',
      label: t('Delete'),
      priority: 'danger',
      onAction: onDelete,
    });
  }
  return menuOptions;
};

const makeUnsavedChangesMenuOptions = ({
  onRename,
  onDuplicate,
  onDelete,
  onSave,
  onDiscard,
}: {
  onDelete?: (key: string) => void;
  onDiscard?: (key: string) => void;
  onDuplicate?: (key: string) => void;
  onRename?: (key: string) => void;
  onSave?: (key: string) => void;
}): MenuItemProps[] => {
  return [
    {
      key: 'changed',
      children: [
        {
          key: 'save-changes',
          label: t('Save Changes'),
          priority: 'primary',
          onAction: onSave,
        },
        {
          key: 'discard-changes',
          label: t('Discard Changes'),
          onAction: onDiscard,
        },
      ],
    },
    {
      key: 'default',
      children: makeDefaultMenuOptions({onRename, onDuplicate, onDelete}),
    },
  ];
};

const makeTempViewMenuOptions = ({
  onSave,
  onDiscard,
}: {
  onDiscard: () => void;
  onSave: () => void;
}): MenuItemProps[] => {
  return [
    {
      key: 'save-changes',
      label: t('Save View'),
      priority: 'primary',
      onAction: onSave,
    },
    {
      key: 'discard-changes',
      label: t('Discard'),
      onAction: onDiscard,
    },
  ];
};

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
