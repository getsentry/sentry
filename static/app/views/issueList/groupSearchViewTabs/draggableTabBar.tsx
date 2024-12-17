import 'intersection-observer'; // polyfill

import {useCallback, useContext, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type {Node} from '@react-types/shared';
import {motion} from 'framer-motion';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  DraggableTabList,
  TEMPORARY_TAB_KEY,
} from 'sentry/components/draggableTabs/draggableTabList';
import type {DraggableTabListItemProps} from 'sentry/components/draggableTabs/item';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {TabsContext} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {DraggableTabMenuButton} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabMenuButton';
import EditableTabTitle from 'sentry/views/issueList/groupSearchViewTabs/editableTabTitle';
import {IssueSortOptions} from 'sentry/views/issueList/utils';
import {NewTabContext, type NewView} from 'sentry/views/issueList/utils/newTabContext';

export interface Tab {
  id: string;
  /**
   * False for tabs that were added view the "Add View" button, but
   * have not been edited in any way. Only tabs with isCommitted=true
   * will be saved to the backend.
   */
  isCommitted: boolean;
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

  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();

  const {cursor: _cursor, page: _page, ...queryParams} = router?.location?.query ?? {};
  const {viewId} = queryParams;

  const {tabListState} = useContext(TabsContext);
  const {setNewViewActive, setOnNewViewsSaved} = useContext(NewTabContext);

  const handleOnReorder = (newOrder: Node<DraggableTabListItemProps>[]) => {
    const newTabs: Tab[] = newOrder
      .map(node => {
        const foundTab = tabs.find(tab => tab.key === node.key);
        return foundTab?.key === node.key ? foundTab : null;
      })
      .filter(defined);
    setTabs(newTabs);
    trackAnalytics('issue_views.reordered_views', {
      organization,
    });
  };

  const handleOnSaveChanges = useCallback(() => {
    const originalTab = tabs.find(tab => tab.key === tabListState?.selectedKey);
    if (originalTab) {
      const newTabs: Tab[] = tabs.map(tab => {
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
      trackAnalytics('issue_views.saved_changes', {
        organization,
      });
    }
  }, [onSave, organization, setTabs, tabListState?.selectedKey, tabs]);

  useHotkeys(
    [
      {
        match: ['command+s', 'ctrl+s'],
        includeInputs: true,
        callback: () => {
          if (tabs.find(tab => tab.key === tabListState?.selectedKey)?.unsavedChanges) {
            handleOnSaveChanges();
            addSuccessMessage(t('Changes saved to view'));
          }
        },
      },
    ],
    [handleOnSaveChanges, tabListState?.selectedKey, tabs]
  );

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
        ...location,
        query: {
          ...queryParams,
          query: originalTab.query,
          sort: originalTab.querySort,
          ...(originalTab.id ? {viewId: originalTab.id} : {}),
        },
      });
      onDiscard?.();
      trackAnalytics('issue_views.discarded_changes', {
        organization,
      });
    }
  };

  const handleOnTabRenamed = (newLabel: string, tabKey: string) => {
    const renamedTab = tabs.find(tb => tb.key === tabKey);
    if (renamedTab && newLabel !== renamedTab.label) {
      const newTabs = tabs.map(tab =>
        tab.key === renamedTab.key ? {...tab, label: newLabel, isCommitted: true} : tab
      );
      setTabs(newTabs);
      onTabRenamed?.(newTabs, newLabel);
      trackAnalytics('issue_views.renamed_view', {
        organization,
      });
    }
  };

  const handleOnDuplicate = () => {
    const idx = tabs.findIndex(tb => tb.key === tabListState?.selectedKey);
    if (idx !== -1) {
      const tempId = generateTempViewId();
      const duplicatedTab = tabs[idx];
      const newTabs: Tab[] = [
        ...tabs.slice(0, idx + 1),
        {
          ...duplicatedTab,
          id: tempId,
          key: tempId,
          label: `${duplicatedTab.label} (Copy)`,
          isCommitted: true,
        },
        ...tabs.slice(idx + 1),
      ];
      navigate({
        ...location,
        query: {
          ...queryParams,
          query: duplicatedTab.query,
          sort: duplicatedTab.querySort,
          viewId: tempId,
        },
      });
      setTabs(newTabs);
      tabListState?.setSelectedKey(tempId);
      onDuplicate?.(newTabs);
      trackAnalytics('issue_views.duplicated_view', {
        organization,
      });
    }
  };

  const handleOnDelete = () => {
    if (tabs.length > 1) {
      const newTabs = tabs.filter(tb => tb.key !== tabListState?.selectedKey);
      setTabs(newTabs);
      tabListState?.setSelectedKey(newTabs[0].key);
      onDelete?.(newTabs);
      trackAnalytics('issue_views.deleted_view', {
        organization,
      });
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
        isCommitted: true,
      };
      const newTabs = [...tabs, newTab];
      navigate(
        {
          ...location,
          query: {
            ...queryParams,
            query: tempTab.query,
            querySort: tempTab.querySort,
            viewId: tempId,
          },
        },
        {replace: true}
      );
      setTabs(newTabs);
      setTempTab(undefined);
      tabListState?.setSelectedKey(tempId);
      onSaveTempView?.(newTabs);
      trackAnalytics('issue_views.temp_view_saved', {
        organization,
      });
    }
  };

  const handleOnDiscardTempView = () => {
    tabListState?.setSelectedKey(tabs[0].key);
    setTempTab(undefined);
    onDiscardTempView?.();
    trackAnalytics('issue_views.temp_view_discarded', {
      organization,
    });
  };

  const handleCreateNewView = () => {
    // Triggers the add view flow page
    setNewViewActive(true);
    const tempId = generateTempViewId();
    const currentTab = tabs.find(tab => tab.key === tabListState?.selectedKey);
    if (currentTab) {
      const newTabs: Tab[] = [
        ...tabs,
        {
          id: tempId,
          key: tempId,
          label: 'New View',
          query: '',
          querySort: IssueSortOptions.DATE,
          isCommitted: false,
        },
      ];
      navigate({
        ...location,
        query: {
          ...queryParams,
          query: '',
          viewId: tempId,
        },
      });
      setTabs(newTabs);
      tabListState?.setSelectedKey(tempId);
      trackAnalytics('issue_views.add_view.clicked', {
        organization,
      });
    }
  };

  const handleNewViewsSaved: NewTabContext['onNewViewsSaved'] = useCallback<
    NewTabContext['onNewViewsSaved']
  >(
    () => (newViews: NewView[]) => {
      if (newViews.length === 0) {
        return;
      }
      setNewViewActive(false);
      const {label, query, saveQueryToView} = newViews[0];
      const remainingNewViews: Tab[] = newViews.slice(1)?.map(view => {
        const newId = generateTempViewId();
        const viewToTab: Tab = {
          id: newId,
          key: newId,
          label: view.label,
          query: view.query,
          querySort: IssueSortOptions.DATE,
          unsavedChanges: view.saveQueryToView
            ? undefined
            : [view.query, IssueSortOptions.DATE],
          isCommitted: true,
        };
        return viewToTab;
      });
      let updatedTabs: Tab[] = tabs.map(tab => {
        if (tab.key === viewId) {
          return {
            ...tab,
            label,
            query: saveQueryToView ? query : '',
            querySort: IssueSortOptions.DATE,
            unsavedChanges: saveQueryToView ? undefined : [query, IssueSortOptions.DATE],
            isCommitted: true,
          };
        }
        return tab;
      });

      if (remainingNewViews.length > 0) {
        updatedTabs = [...updatedTabs, ...remainingNewViews];
      }

      setTabs(updatedTabs);
      navigate(
        {
          ...location,
          query: {
            ...queryParams,
            query,
            sort: IssueSortOptions.DATE,
          },
        },
        {replace: true}
      );
      onAddView?.(updatedTabs);
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location, navigate, onAddView, setNewViewActive, setTabs, tabs, viewId]
  );

  useEffect(() => {
    setOnNewViewsSaved(handleNewViewsSaved);
  }, [setOnNewViewsSaved, handleNewViewsSaved]);

  const makeMenuOptions = (tab: Tab): MenuItemProps[] => {
    if (tab.key === TEMPORARY_TAB_KEY) {
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
      onReorderComplete={() => onReorder?.(tabs)}
      defaultSelectedKey={initialTabKey}
      onAddView={handleCreateNewView}
      orientation="horizontal"
      editingTabKey={editingTabKey ?? undefined}
      hideBorder
    >
      {allTabs.map(tab => (
        <DraggableTabList.Item
          textValue={tab.label}
          key={tab.key}
          to={normalizeUrl({
            query: {
              ...queryParams,
              query: tab.unsavedChanges?.[0] ?? tab.query,
              sort: tab.unsavedChanges?.[1] ?? tab.querySort,
              viewId: tab.id !== TEMPORARY_TAB_KEY ? tab.id : undefined,
            },
            pathname: `/organizations/${orgSlug}/issues/`,
          })}
          disabled={tab.key === editingTabKey}
        >
          <TabContentWrap>
            <EditableTabTitle
              label={tab.label}
              isEditing={editingTabKey === tab.key}
              setIsEditing={isEditing => setEditingTabKey(isEditing ? tab.key : null)}
              onChange={newLabel => handleOnTabRenamed(newLabel.trim(), tab.key)}
              isSelected={
                (tabListState && tabListState?.selectedKey === tab.key) ||
                (!tabListState && tab.key === initialTabKey)
              }
            />
            {/* If tablistState isn't initialized, we want to load the elipsis menu
                for the initial tab, that way it won't load in a second later
                and cause the tabs to shift and animate on load.
            */}
            {((tabListState && tabListState?.selectedKey === tab.key) ||
              (!tabListState && tab.key === initialTabKey)) && (
              <motion.div
                // This stops the ellipsis menu from animating in on load (when tabListState isn't initialized yet),
                // but enables the animation later on when switching tabs
                initial={tabListState ? {opacity: 0} : false}
                animate={{opacity: 1}}
                transition={{delay: 0.1, duration: 0.1}}
              >
                <DraggableTabMenuButton
                  hasUnsavedChanges={!!tab.unsavedChanges}
                  menuOptions={makeMenuOptions(tab)}
                  aria-label={t(`%s Ellipsis Menu`, tab.label)}
                />
              </motion.div>
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
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRename?: () => void;
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
  onDelete?: () => void;
  onDiscard?: () => void;
  onDuplicate?: () => void;
  onRename?: () => void;
  onSave?: () => void;
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
