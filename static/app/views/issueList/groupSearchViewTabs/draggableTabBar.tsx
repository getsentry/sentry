import 'intersection-observer'; // polyfill

import {useContext, useState} from 'react';
import styled from '@emotion/styled';
import type {Node} from '@react-types/shared';

import {DraggableTabList} from 'sentry/components/draggableTabs/draggableTabList';
import type {DraggableTabListItemProps} from 'sentry/components/draggableTabs/item';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {TabsContext} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {defined} from 'sentry/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DraggableTabMenuButton} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabMenuButton';
import EditableTabTitle from 'sentry/views/issueList/groupSearchViewTabs/editableTabTitle';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

export interface Tab {
  id: string;
  key: string;
  label: string;
  query: string;
  querySort: IssueSortOptions;
  content?: React.ReactNode;
  unsavedChanges?: [string, IssueSortOptions];
}

export interface DraggableTabBarProps {
  initialTabKey: string;
  orgSlug: string;
  router: InjectedRouter;
  setTabs: (tabs: Tab[]) => void;
  setTempTab: (tab: Tab | undefined) => void;
  tabs: Tab[];
  /**
   * Callback function to be called when user clicks the `Add View` button.
   */
  onAddView?: (newTabs: Tab[]) => void;
  /**
   * Callback function to be called when user clicks the `Delete` button.
   * Note: The `Delete` button only appears for persistent views
   */
  onDelete?: (newTabs: Tab[]) => void;
  /**
   * Callback function to be called when user clicks on the `Discard Changes` button.
   * Note: The `Discard Changes` button only appears for persistent views when `isChanged=true`
   */
  onDiscard?: () => void;
  /**
   * Callback function to be called when user clicks on the `Discard` button for temporary views.
   * Note: The `Discard` button only appears for temporary views
   */
  onDiscardTempView?: () => void;
  /**
   * Callback function to be called when user clicks the 'Duplicate' button.
   * Note: The `Duplicate` button only appears for persistent views
   */
  onDuplicate?: (newTabs: Tab[]) => void;
  /**
   * Callback function to be called when the user reorders the tabs. Returns the
   * new order of the tabs along with their props.
   */
  onReorder?: (newTabs: Tab[]) => void;
  /**
   * Callback function to be called when user clicks the 'Save' button.
   * Note: The `Save` button only appears for persistent views when `isChanged=true`
   */
  onSave?: (newTabs: Tab[]) => void;
  /**
   * Callback function to be called when user clicks the 'Save View' button for temporary views.
   */
  onSaveTempView?: (newTabs: Tab[]) => void;
  /**
   * Callback function to be called when user renames a tab.
   * Note: The `Rename` button only appears for persistent views
   */
  onTabRenamed?: (newTabs: Tab[], newLabel: string) => void;
  tempTab?: Tab;
}

export const generateTempViewId = () => `_${Math.random().toString().substring(2, 7)}`;

export function DraggableTabBar({
  initialTabKey,
  tabs,
  setTabs,
  tempTab,
  setTempTab,
  orgSlug,
  router,
  onReorder,
  onAddView,
  onDelete,
  onDiscard,
  onDuplicate,
  onTabRenamed,
  onSave,
  onDiscardTempView,
  onSaveTempView,
}: DraggableTabBarProps) {
  // TODO: Extract this to a separate component encompassing Tab.Item in the future
  const [editingTabKey, setEditingTabKey] = useState<string | null>(null);

  const navigate = useNavigate();

  const {cursor: _cursor, page: _page, ...queryParams} = router?.location?.query ?? {};

  const {tabListState} = useContext(TabsContext);

  const handleOnReorder = (newOrder: Node<DraggableTabListItemProps>[]) => {
    const newTabs = newOrder
      .map(node => {
        const foundTab = tabs.find(tab => tab.key === node.key);
        return foundTab?.key === node.key ? foundTab : null;
      })
      .filter(defined);
    setTabs(newTabs);
    onReorder?.(newTabs);
  };

  const handleOnSaveChanges = () => {
    const originalTab = tabs.find(tab => tab.key === tabListState?.selectedKey);
    if (originalTab) {
      const newTabs = tabs.map(tab => {
        return tab.key === tabListState?.selectedKey && tab.unsavedChanges
          ? {
              ...tab,
              query: tab.unsavedChanges[0],
              querySort: tab.unsavedChanges[1],
              unsavedChanges: undefined,
            }
          : tab;
      });
      setTabs(newTabs);
      onSave?.(newTabs);
    }
  };

  const handleOnDiscardChanges = () => {
    const originalTab = tabs.find(tab => tab.key === tabListState?.selectedKey);
    if (originalTab) {
      setTabs(
        tabs.map(tab => {
          return tab.key === tabListState?.selectedKey
            ? {...tab, unsavedChanges: undefined}
            : tab;
        })
      );
      navigate({
        query: {
          ...queryParams,
          query: originalTab.query,
          sort: originalTab.querySort,
          ...(originalTab.id ? {viewId: originalTab.id} : {}),
        },
        pathname: `/organizations/${orgSlug}/issues/`,
      });
      onDiscard?.();
    }
  };

  const handleOnTabRenamed = (newLabel: string, tabKey: string) => {
    const renamedTab = tabs.find(tb => tb.key === tabKey);
    if (renamedTab && newLabel !== renamedTab.label) {
      const newTabs = tabs.map(tab =>
        tab.key === renamedTab.key ? {...tab, label: newLabel} : tab
      );
      setTabs(newTabs);
      onTabRenamed?.(newTabs, newLabel);
    }
  };

  const handleOnDuplicate = () => {
    const idx = tabs.findIndex(tb => tb.key === tabListState?.selectedKey);
    if (idx !== -1) {
      const tempId = generateTempViewId();
      const duplicatedTab = tabs[idx];
      const newTabs = [
        ...tabs.slice(0, idx + 1),
        {
          ...duplicatedTab,
          id: tempId,
          key: tempId,
          label: `${duplicatedTab.label} (Copy)`,
        },
        ...tabs.slice(idx + 1),
      ];
      navigate({
        query: {
          ...queryParams,
          viewId: tempId,
        },
        pathname: `/organizations/${orgSlug}/issues/`,
      });
      setTabs(newTabs);
      tabListState?.setSelectedKey(tempId);
      onDuplicate?.(newTabs);
    }
  };

  const handleOnDelete = () => {
    if (tabs.length > 1) {
      const newTabs = tabs.filter(tb => tb.key !== tabListState?.selectedKey);
      setTabs(newTabs);
      tabListState?.setSelectedKey(newTabs[0].key);
      onDelete?.(newTabs);
    }
  };

  const handleOnSaveTempView = () => {
    if (tempTab) {
      const tempId = generateTempViewId();
      const newTab: Tab = {
        id: tempId,
        key: tempId,
        label: 'New View',
        query: tempTab.query,
        querySort: tempTab.querySort,
      };
      const newTabs = [...tabs, newTab];
      setTabs(newTabs);
      tabListState?.setSelectedKey(tempId);
      onSaveTempView?.(newTabs);
    }
  };

  const handleOnDiscardTempView = () => {
    tabListState?.setSelectedKey(tabs[0].key);
    setTempTab(undefined);
    onDiscardTempView?.();
  };

  const handleOnAddView = () => {
    const tempId = generateTempViewId();
    const currentTab = tabs.find(tab => tab.key === tabListState?.selectedKey);
    if (currentTab) {
      const newTabs = [
        ...tabs,
        {
          id: tempId,
          key: tempId,
          label: 'New View',
          query: currentTab.unsavedChanges
            ? currentTab.unsavedChanges[0]
            : currentTab.query,
          querySort: currentTab.unsavedChanges
            ? currentTab.unsavedChanges[1]
            : currentTab.querySort,
        },
      ];
      navigate({
        query: {
          ...queryParams,
          viewId: tempId,
        },
        pathname: `/organizations/${orgSlug}/issues/`,
      });
      setTabs(newTabs);
      tabListState?.setSelectedKey(tempId);
      onAddView?.(newTabs);
    }
  };

  const makeMenuOptions = (tab: Tab): MenuItemProps[] => {
    if (tab.key === 'temporary-tab') {
      return makeTempViewMenuOptions({
        onSaveTempView: handleOnSaveTempView,
        onDiscardTempView: handleOnDiscardTempView,
      });
    }
    if (tab.unsavedChanges) {
      return makeUnsavedChangesMenuOptions({
        onRename: () => setEditingTabKey(tab.key),
        onDuplicate: handleOnDuplicate,
        onDelete: tabs.length > 1 ? handleOnDelete : undefined,
        onSave: handleOnSaveChanges,
        onDiscard: handleOnDiscardChanges,
      });
    }
    return makeDefaultMenuOptions({
      onRename: () => setEditingTabKey(tab.key),
      onDuplicate: handleOnDuplicate,
      onDelete: tabs.length > 1 ? handleOnDelete : undefined,
    });
  };

  const allTabs = tempTab ? [...tabs, tempTab] : tabs;

  return (
    <DraggableTabList
      onReorder={handleOnReorder}
      defaultSelectedKey={initialTabKey}
      onAddView={handleOnAddView}
      orientation="horizontal"
      hideBorder
    >
      {allTabs.map(tab => (
        <DraggableTabList.Item
          textValue={`${tab.label} tab`}
          key={tab.key}
          to={normalizeUrl({
            query: {
              ...queryParams,
              query: tab.unsavedChanges?.[0] ?? tab.query,
              sort: tab.unsavedChanges?.[1] ?? tab.querySort,
              ...(tab.id !== 'temporary-tab' ? {viewId: tab.id} : {}),
            },
            pathname: `/organizations/${orgSlug}/issues/`,
          })}
        >
          <TabContentWrap>
            <EditableTabTitle
              label={tab.label}
              isEditing={editingTabKey === tab.key}
              setIsEditing={isEditing => setEditingTabKey(isEditing ? tab.key : null)}
              onChange={newLabel => handleOnTabRenamed(newLabel.trim(), tab.key)}
              isSelected={tabListState?.selectedKey === tab.key}
            />
            {tabListState?.selectedKey === tab.key && (
              <DraggableTabMenuButton
                hasUnsavedChanges={!!tab.unsavedChanges}
                menuOptions={makeMenuOptions(tab)}
                aria-label={`${tab.label} Tab Options`}
              />
            )}
          </TabContentWrap>
        </DraggableTabList.Item>
      ))}
    </DraggableTabList>
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
  onSaveTempView,
  onDiscardTempView,
}: {
  onDiscardTempView: () => void;
  onSaveTempView: () => void;
}): MenuItemProps[] => {
  return [
    {
      key: 'save-changes',
      label: t('Save View'),
      priority: 'primary',
      onAction: onSaveTempView,
    },
    {
      key: 'discard-changes',
      label: t('Discard'),
      onAction: onDiscardTempView,
    },
  ];
};

const TabContentWrap = styled('span')`
  white-space: nowrap;
  display: flex;
  align-items: center;
  flex-direction: row;
  padding: 0;
  gap: 6px;
`;
