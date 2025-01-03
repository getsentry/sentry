import {useContext} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {TEMPORARY_TAB_KEY} from 'sentry/components/draggableTabs/draggableTabList';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import EditableTabTitle from 'sentry/views/issueList/issueViews/editableTabTitle';
import {IssueViewEllipsisMenu} from 'sentry/views/issueList/issueViews/issueViewEllipsisMenu';
import {
  generateTempViewId,
  type IssueView,
  IssueViewsContext,
} from 'sentry/views/issueList/issueViews/issueViews';

interface IssueViewTabProps {
  editingTabKey: string | null;
  initialTabKey: string;
  setEditingTabKey: (key: string | null) => void;
  view: IssueView;
}

export function IssueViewTab({
  editingTabKey,
  initialTabKey,
  setEditingTabKey,
  view,
}: IssueViewTabProps) {
  const [_searchParams, setSearchParams] = useSearchParams();
  const {tabListState, state, dispatch} = useContext(IssueViewsContext);
  const {views} = state;

  const handleDuplicateView = () => {
    const newViewId = generateTempViewId();
    const duplicatedTab = views.find(tab => tab.key === tabListState?.selectedKey);
    if (!duplicatedTab) {
      return;
    }
    dispatch({type: 'DUPLICATE_VIEW', newViewId, syncViews: true});
    setSearchParams(prev => {
      prev.set('viewId', newViewId);
      prev.set('query', duplicatedTab.query);
      prev.set('sort', duplicatedTab.querySort);
      return prev;
    });
  };

  const handleDiscardChanges = () => {
    dispatch({type: 'DISCARD_CHANGES'});
    const originalTab = views.find(tab => tab.key === tabListState?.selectedKey);
    if (originalTab) {
      setSearchParams(prev => {
        prev.set('query', originalTab.query);
        prev.set('sort', originalTab.querySort);
        prev.set('viewId', originalTab.id);
        return prev;
      });
    }
  };

  const handleDeleteView = (tab: IssueView) => {
    dispatch({type: 'DELETE_VIEW', syncViews: true});
    // Including this logic in the dispatch call breaks the tests for some reason
    // so we're doing it here instead
    const nextTab = views.find(tb => tb.key !== tab.key);
    if (nextTab) {
      tabListState?.setSelectedKey(nextTab.key);
    }
  };

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
        onDelete: views.length > 1 ? () => handleDeleteView(tab) : undefined,
        onSave: () => dispatch({type: 'SAVE_CHANGES', syncViews: true}),
        onDiscard: handleDiscardChanges,
      });
    }
    return makeDefaultMenuOptions({
      onRename: () => setEditingTabKey(tab.key),
      onDuplicate: handleDuplicateView,
      onDelete: views.length > 1 ? () => handleDeleteView(tab) : undefined,
    });
  };

  return (
    <TabContentWrap>
      <EditableTabTitle
        label={view.label}
        isEditing={editingTabKey === view.key}
        setIsEditing={isEditing => setEditingTabKey(isEditing ? view.key : null)}
        onChange={newLabel =>
          dispatch({type: 'RENAME_TAB', newLabel: newLabel.trim(), syncViews: true})
        }
        isSelected={
          (tabListState && tabListState?.selectedKey === view.key) ||
          (!tabListState && view.key === initialTabKey)
        }
      />
      {/* If tablistState isn't initialized, we want to load the elipsis menu
          for the initial tab, that way it won't load in a second later
          and cause the tabs to shift and animate on load. */}
      {((tabListState && tabListState?.selectedKey === view.key) ||
        (!tabListState && view.key === initialTabKey)) && (
        <motion.div
          // This stops the ellipsis menu from animating in on load (when tabListState isn't initialized yet),
          // but enables the animation later on when switching tabs
          initial={tabListState ? {opacity: 0} : false}
          animate={{opacity: 1}}
          transition={{delay: 0.1, duration: 0.1}}
        >
          <IssueViewEllipsisMenu
            hasUnsavedChanges={!!view.unsavedChanges}
            menuOptions={makeMenuOptions(view)}
            aria-label={t(`%s Ellipsis Menu`, view.label)}
          />
        </motion.div>
      )}
    </TabContentWrap>
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
