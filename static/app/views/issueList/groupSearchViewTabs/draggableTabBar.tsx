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
import {t} from 'sentry/locale';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {DraggableTabMenuButton} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabMenuButton';
import EditableTabTitle from 'sentry/views/issueList/groupSearchViewTabs/editableTabTitle';
import {
  type IssueView,
  IssueViewsContext,
} from 'sentry/views/issueList/groupSearchViewTabs/issueViews';
import {IssueSortOptions} from 'sentry/views/issueList/utils';
import {NewTabContext, type NewView} from 'sentry/views/issueList/utils/newTabContext';

export interface DraggableTabBarProps {
  initialTabKey: string;
  router: InjectedRouter;
}

export const generateTempViewId = () => `_${Math.random().toString().substring(2, 7)}`;

export function DraggableTabBar({initialTabKey, router}: DraggableTabBarProps) {
  // TODO: Extract this to a separate component encompassing Tab.Item in the future
  const [editingTabKey, setEditingTabKey] = useState<string | null>(null);

  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();

  const {cursor: _cursor, page: _page, ...queryParams} = router?.location?.query ?? {};
  const {viewId} = queryParams;

  const {setNewViewActive, setOnNewViewsSaved} = useContext(NewTabContext);
  const {tabListState, state, dispatch} = useContext(IssueViewsContext);
  const {views: tabs, tempView: tempTab} = state;

  useHotkeys(
    [
      {
        match: ['command+s', 'ctrl+s'],
        includeInputs: true,
        callback: () => {
          if (tabs.find(tab => tab.key === tabListState?.selectedKey)?.unsavedChanges) {
            dispatch({type: 'SAVE_CHANGES', syncViews: true});
            addSuccessMessage(t('Changes saved to view'));
          }
        },
      },
    ],
    [dispatch, tabListState?.selectedKey, tabs]
  );

  const handleDuplicateView = () => {
    const newViewId = generateTempViewId();
    const duplicatedTab = state.views.find(
      view => view.key === tabListState?.selectedKey
    );
    if (!duplicatedTab) {
      return;
    }
    dispatch({type: 'DUPLICATE_VIEW', newViewId, syncViews: true});
    navigate({
      ...location,
      query: {
        ...queryParams,
        query: duplicatedTab.query,
        sort: duplicatedTab.querySort,
        viewId: newViewId,
      },
    });
  };

  const handleDiscardChanges = () => {
    dispatch({type: 'DISCARD_CHANGES'});
    const originalTab = state.views.find(view => view.key === tabListState?.selectedKey);
    if (originalTab) {
      // TODO(msun): Move navigate logic to IssueViewsContext
      navigate({
        ...location,
        query: {
          ...queryParams,
          query: originalTab.query,
          sort: originalTab.querySort,
          viewId: originalTab.id,
        },
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
      const {label, query, saveQueryToView} = newViews[0]!;
      const remainingNewViews: IssueView[] = newViews.slice(1)?.map(view => {
        const newId = generateTempViewId();
        const viewToTab: IssueView = {
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
      let updatedTabs: IssueView[] = tabs.map(tab => {
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

      dispatch({type: 'SET_VIEWS', views: updatedTabs, syncViews: true});
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
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location, navigate, setNewViewActive, tabs, viewId]
  );

  const handleCreateNewView = () => {
    const tempId = generateTempViewId();
    dispatch({type: 'CREATE_NEW_VIEW', tempId});
    tabListState?.setSelectedKey(tempId);
    navigate({
      ...location,
      query: {
        ...queryParams,
        query: '',
        viewId: tempId,
      },
    });
  };

  const handleDeleteView = (tab: IssueView) => {
    dispatch({type: 'DELETE_VIEW', syncViews: true});
    // Including this logic in the dispatch call breaks the tests for some reason
    // so we're doing it here instead
    tabListState?.setSelectedKey(tabs.filter(tb => tb.key !== tab.key)[0]!.key);
  };

  useEffect(() => {
    setOnNewViewsSaved(handleNewViewsSaved);
  }, [setOnNewViewsSaved, handleNewViewsSaved]);

  const makeMenuOptions = (tab: IssueView): MenuItemProps[] => {
    if (tab.key === TEMPORARY_TAB_KEY) {
      return makeTempViewMenuOptions({
        onSaveTempView: () => dispatch({type: 'SAVE_TEMP_VIEW', syncViews: true}),
        onDiscardTempView: () => dispatch({type: 'DISCARD_TEMP_VIEW'}),
      });
    }
    if (tab.unsavedChanges) {
      return makeUnsavedChangesMenuOptions({
        onRename: () => setEditingTabKey(tab.key),
        onDuplicate: handleDuplicateView,
        onDelete: tabs.length > 1 ? () => handleDeleteView(tab) : undefined,
        onSave: () => dispatch({type: 'SAVE_CHANGES', syncViews: true}),
        onDiscard: handleDiscardChanges,
      });
    }
    return makeDefaultMenuOptions({
      onRename: () => setEditingTabKey(tab.key),
      onDuplicate: handleDuplicateView,
      onDelete: tabs.length > 1 ? () => handleDeleteView(tab) : undefined,
    });
  };

  const allTabs = tempTab ? [...tabs, tempTab] : tabs;

  return (
    <DraggableTabList
      onReorder={(newOrder: Node<DraggableTabListItemProps>[]) =>
        dispatch({
          type: 'REORDER_TABS',
          newKeyOrder: newOrder.map(node => node.key.toString()),
        })
      }
      onReorderComplete={() => dispatch({type: 'SYNC_VIEWS_TO_BACKEND'})}
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
            pathname: `/organizations/${organization.slug}/issues/`,
          })}
          disabled={tab.key === editingTabKey}
        >
          <TabContentWrap>
            <EditableTabTitle
              label={tab.label}
              isEditing={editingTabKey === tab.key}
              setIsEditing={isEditing => setEditingTabKey(isEditing ? tab.key : null)}
              onChange={newLabel =>
                dispatch({type: 'RENAME_TAB', newLabel: newLabel.trim(), syncViews: true})
              }
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
    return [
      ...menuOptions,
      {
        key: 'delete-tab',
        label: t('Delete'),
        priority: 'danger',
        onAction: onDelete,
      },
    ];
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
