import type {Dispatch, Reducer} from 'react';
import {createContext, useCallback, useMemo, useReducer, useState} from 'react';
import styled from '@emotion/styled';
import type {TabListState} from '@react-stately/tabs';
import type {Orientation} from '@react-types/shared';
import debounce from 'lodash/debounce';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {TabContext, TabsProps} from 'sentry/components/tabs';
import {tabsShouldForwardProp} from 'sentry/components/tabs/utils';
import {t} from 'sentry/locale';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {defined} from 'sentry/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {generateTempViewId} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabBar';
import {useUpdateGroupSearchViews} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViews';
import type {
  GroupSearchView,
  UpdateGroupSearchViewPayload,
} from 'sentry/views/issueList/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

const TEMPORARY_TAB_KEY = 'temporary-tab';

export interface IssueView {
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

// export interface IssueViewsProps<T> extends TabsProps<T> {}

type ReorderTabsAction = {
  newKeyOrder: string[];
  type: 'REORDER_TABS';
};

type SaveChangesAction = {
  type: 'SAVE_CHANGES';
};

type DiscardChangesAction = {
  type: 'DISCARD_CHANGES';
};

type RenameTabAction = {
  newLabel: string;
  type: 'RENAME_TAB';
};

type DuplicateViewAction = {
  newViewId: string;
  type: 'DUPLICATE_VIEW';
};

type DeleteViewAction = {
  type: 'DELETE_VIEW';
};

type CreateNewViewAction = {
  tempId: string;
  type: 'CREATE_NEW_VIEW';
};

type SetTempViewAction = {
  query: string;
  sort: IssueSortOptions;
  type: 'SET_TEMP_VIEW';
};

type DiscardTempViewAction = {
  type: 'DISCARD_TEMP_VIEW';
};

type SaveTempViewAction = {
  type: 'SAVE_TEMP_VIEW';
};

type UpdateUnsavedChangesAction = {
  type: 'UPDATE_UNSAVED_CHANGES';
  unsavedChanges: [string, IssueSortOptions] | undefined;
  isCommitted?: boolean;
  syncViews?: boolean;
};

type UpdateViewIdsAction = {
  newViews: UpdateGroupSearchViewPayload[];
  type: 'UPDATE_VIEW_IDS';
};

type SetViewsAction = {
  type: 'SET_VIEWS';
  views: IssueView[];
  syncViews?: boolean;
};

type SyncViewsToBackendAction = {
  type: 'SYNC_VIEWS_TO_BACKEND';
};

export type IssueViewsActions =
  | ReorderTabsAction
  | SaveChangesAction
  | DiscardChangesAction
  | RenameTabAction
  | DuplicateViewAction
  | DeleteViewAction
  | CreateNewViewAction
  | SetTempViewAction
  | DiscardTempViewAction
  | SaveTempViewAction
  | UpdateUnsavedChangesAction
  | UpdateViewIdsAction
  | SetViewsAction
  | SyncViewsToBackendAction;

export interface IssueViewsState {
  views: IssueView[];
  tempView?: IssueView;
}

export interface IssueViewsContextType extends TabContext {
  dispatch: Dispatch<IssueViewsActions>;
  state: IssueViewsState;
}

export const IssueViewsContext = createContext<IssueViewsContextType>({
  rootProps: {orientation: 'horizontal'},
  setTabListState: () => {},
  // Issue Views specific state
  dispatch: () => {},
  state: {views: []},
});

function reorderTabs(state: IssueViewsState, action: ReorderTabsAction) {
  const newTabs: IssueView[] = action.newKeyOrder
    .map(key => {
      const foundTab = state.views.find(tab => tab.key === key);
      return foundTab?.key === key ? foundTab : null;
    })
    .filter(defined);
  return {...state, views: newTabs};
}

function saveChanges(state: IssueViewsState, tabListState: TabListState<any>) {
  const originalTab = state.views.find(tab => tab.key === tabListState?.selectedKey);
  if (originalTab) {
    const newViews = state.views.map(tab => {
      return tab.key === tabListState?.selectedKey && tab.unsavedChanges
        ? {
            ...tab,
            query: tab.unsavedChanges[0],
            querySort: tab.unsavedChanges[1],
            unsavedChanges: undefined,
          }
        : tab;
    });
    return {...state, views: newViews};
  }
  return state;
}

function discardChanges(state: IssueViewsState, tabListState: TabListState<any>) {
  const originalTab = state.views.find(tab => tab.key === tabListState?.selectedKey);
  if (originalTab) {
    const newViews = state.views.map(tab => {
      return tab.key === tabListState?.selectedKey
        ? {...tab, unsavedChanges: undefined}
        : tab;
    });
    return {...state, views: newViews};
  }
  return state;
}

function renameView(
  state: IssueViewsState,
  action: RenameTabAction,
  tabListState: TabListState<any>
) {
  const renamedTab = state.views.find(tab => tab.key === tabListState?.selectedKey);
  if (renamedTab && action.newLabel !== renamedTab.label) {
    const newViews = state.views.map(tab =>
      tab.key === renamedTab.key
        ? {...tab, label: action.newLabel, isCommitted: true}
        : tab
    );
    return {...state, views: newViews};
  }
  return state;
}

function duplicateView(
  state: IssueViewsState,
  action: DuplicateViewAction,
  tabListState: TabListState<any>
) {
  const idx = state.views.findIndex(tb => tb.key === tabListState?.selectedKey);
  if (idx !== -1) {
    const duplicatedTab = state.views[idx];
    const newTabs: IssueView[] = [
      ...state.views.slice(0, idx + 1),
      {
        ...duplicatedTab,
        id: action.newViewId,
        key: action.newViewId,
        label: `${duplicatedTab.label} (Copy)`,
        isCommitted: true,
      },
      ...state.views.slice(idx + 1),
    ];
    return {...state, views: newTabs};
  }
  return state;
}

function deleteView(state: IssueViewsState, tabListState: TabListState<any>) {
  const newViews = state.views.filter(tab => tab.key !== tabListState?.selectedKey);
  // TODO(msun): wtf
  // tabListState?.setSelectedKey(newViews[0].key);
  return {...state, views: newViews};
}

function createNewView(state: IssueViewsState, action: CreateNewViewAction) {
  const newTabs: IssueView[] = [
    ...state.views,
    {
      id: action.tempId,
      key: action.tempId,
      label: 'New View',
      query: '',
      querySort: IssueSortOptions.DATE,
      isCommitted: false,
    },
  ];
  return {...state, views: newTabs};
}

function setTempView(state: IssueViewsState, action: SetTempViewAction) {
  const tempView: IssueView = {
    id: TEMPORARY_TAB_KEY,
    key: TEMPORARY_TAB_KEY,
    label: t('Unsaved'),
    query: action.query,
    querySort: action.sort ?? IssueSortOptions.DATE,
    isCommitted: true,
  };
  return {...state, tempView};
}

function discardTempView(state: IssueViewsState, tabListState: TabListState<any>) {
  tabListState?.setSelectedKey(state.views[0].key);
  return {...state, tempView: undefined};
}

function saveTempView(state: IssueViewsState, tabListState: TabListState<any>) {
  if (state.tempView) {
    const tempId = generateTempViewId();
    const newTab: IssueView = {
      id: tempId,
      key: tempId,
      label: 'New View',
      query: state.tempView?.query,
      querySort: state.tempView?.querySort,
      isCommitted: true,
    };
    tabListState?.setSelectedKey(tempId);
    return {...state, views: [...state.views, newTab], tempView: undefined};
  }
  return state;
}

function updateUnsavedChanges(
  state: IssueViewsState,
  action: UpdateUnsavedChangesAction,
  tabListState: TabListState<any>
) {
  return {
    ...state,
    views: state.views.map(tab =>
      tab.key === tabListState?.selectedKey
        ? {
            ...tab,
            unsavedChanges: action.unsavedChanges,
            isCommitted: action.isCommitted ?? tab.isCommitted,
          }
        : tab
    ),
  };
}

function updateViewIds(state: IssueViewsState, action: UpdateViewIdsAction) {
  const assignedIds = new Set();
  const updatedViews = state.views.map(tab => {
    if (tab.id && tab.id[0] === '_') {
      const matchingView = action.newViews.find(
        view =>
          view.id &&
          !assignedIds.has(view.id) &&
          tab.query === view.query &&
          tab.querySort === view.querySort &&
          tab.label === view.name
      );
      if (matchingView?.id) {
        assignedIds.add(matchingView.id);
        return {...tab, id: matchingView.id};
      }
    }
    return tab;
  });
  return {...state, views: updatedViews};
}

function setViews(state: IssueViewsState, action: SetViewsAction) {
  return {...state, views: action.views};
}

interface IssueViewsStateProviderProps {
  children: React.ReactNode;
  initialViews: IssueView[];
  // TODO(msun): Replace router with useLocation() / useUrlParams() / useSearchParams() in the future
  router: InjectedRouter;
}

export function IssueViewsStateProvider({
  children,
  initialViews,
  router,
}: IssueViewsStateProviderProps) {
  const navigate = useNavigate();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const [tabListState, setTabListState] = useState<TabListState<any>>();
  const {cursor: _cursor, page: _page, ...queryParams} = router?.location.query;
  const {query, sort, viewId, project, environment} = queryParams;

  const queryParamsWithPageFilters = useMemo(() => {
    return {
      ...queryParams,
      project: project ?? pageFilters.selection.projects,
      environment: environment ?? pageFilters.selection.environments,
      ...normalizeDateTimeParams(pageFilters.selection.datetime),
    };
  }, [
    environment,
    pageFilters.selection.datetime,
    pageFilters.selection.environments,
    pageFilters.selection.projects,
    project,
    queryParams,
  ]);

  // This function is fired upon receiving new views from the backend - it replaces any previously
  // generated temporary view ids with the permanent view ids from the backend
  const replaceWithPersistantViewIds = (views: GroupSearchView[]) => {
    const newlyCreatedViews = views.filter(
      view => !state.views.find(tab => tab.id === view.id)
    );
    if (newlyCreatedViews.length > 0) {
      dispatch({type: 'UPDATE_VIEW_IDS', newViews: newlyCreatedViews});
      const currentView = state.views.find(tab => tab.id === viewId);

      if (viewId?.startsWith('_') && currentView) {
        const matchingView = newlyCreatedViews.find(
          view =>
            view.id &&
            currentView.query === view.query &&
            currentView.querySort === view.querySort
        );
        if (matchingView?.id) {
          navigate(
            normalizeUrl({
              ...location,
              query: {
                ...queryParamsWithPageFilters,
                viewId: matchingView.id,
              },
            }),
            {replace: true}
          );
        }
      }
    }
    return;
  };

  const {mutate: updateViews} = useUpdateGroupSearchViews({
    onSuccess: replaceWithPersistantViewIds,
  });

  const debounceUpdateViews = useMemo(
    () =>
      debounce((newTabs: IssueView[]) => {
        if (newTabs) {
          updateViews({
            orgSlug: organization.slug,
            groupSearchViews: newTabs
              .filter(tab => tab.isCommitted)
              .map(tab => ({
                // Do not send over an ID if it's a temporary or default tab so that
                // the backend will save these and generate permanent Ids for them
                ...(tab.id[0] !== '_' && !tab.id.startsWith('default')
                  ? {id: tab.id}
                  : {}),
                name: tab.label,
                query: tab.query,
                querySort: tab.querySort,
              })),
          });
        }
      }, 500),
    [organization.slug, updateViews]
  );

  const reducer: Reducer<IssueViewsState, IssueViewsActions> = useCallback(
    (state, action): IssueViewsState => {
      if (!tabListState) {
        return state;
      }
      // eslint-disable-next-line no-console
      console.log('executing dispatch', state, action);
      let newState;
      switch (action.type) {
        case 'REORDER_TABS':
          newState = reorderTabs(state, action);
          debounceUpdateViews(newState.views);
          return newState;
        case 'SAVE_CHANGES':
          newState = saveChanges(state, tabListState);
          debounceUpdateViews(newState.views);
          return newState;
        case 'DISCARD_CHANGES':
          return discardChanges(state, tabListState);
        case 'RENAME_TAB':
          newState = renameView(state, action, tabListState);
          debounceUpdateViews(newState.views);
          return newState;
        case 'DUPLICATE_VIEW':
          newState = duplicateView(state, action, tabListState);
          debounceUpdateViews(newState.views);
          return newState;
        case 'DELETE_VIEW':
          newState = deleteView(state, tabListState);
          debounceUpdateViews(newState.views);
          return newState;
        case 'CREATE_NEW_VIEW':
          return createNewView(state, action);
        case 'SET_TEMP_VIEW':
          return setTempView(state, action);
        case 'DISCARD_TEMP_VIEW':
          return discardTempView(state, tabListState);
        case 'SAVE_TEMP_VIEW':
          newState = saveTempView(state, tabListState);
          debounceUpdateViews(newState.views);
          return newState;
        case 'UPDATE_UNSAVED_CHANGES':
          newState = updateUnsavedChanges(state, action, tabListState);
          if (action.syncViews) {
            debounceUpdateViews(newState.views);
          }
          return newState;
        case 'UPDATE_VIEW_IDS':
          return updateViewIds(state, action);
        case 'SET_VIEWS':
          newState = setViews(state, action);
          if (action.syncViews) {
            debounceUpdateViews(newState.views);
          }
          return newState;
        case 'SYNC_VIEWS_TO_BACKEND':
          debounceUpdateViews(state.views);
          return state;
        default:
          return state;
      }
    },
    [tabListState, debounceUpdateViews]
  );

  const sortOption =
    sort && Object.values(IssueSortOptions).includes(sort.toString() as IssueSortOptions)
      ? (sort.toString() as IssueSortOptions)
      : IssueSortOptions.DATE;

  const initialTempView: IssueView | undefined =
    query && (!viewId || !initialViews.find(tab => tab.id === viewId))
      ? {
          id: TEMPORARY_TAB_KEY,
          key: TEMPORARY_TAB_KEY,
          label: t('Unsaved'),
          query: query.toString(),
          querySort: sortOption,
          isCommitted: true,
        }
      : undefined;

  const [state, dispatch] = useReducer(reducer, {
    views: initialViews,
    tempView: initialTempView,
  });

  return (
    <IssueViewsContext.Provider
      value={{
        rootProps: {orientation: 'horizontal'},
        tabListState,
        setTabListState,
        dispatch,
        state,
      }}
    >
      {children}
    </IssueViewsContext.Provider>
  );
}

export function IssueViews<T extends string | number>({
  orientation = 'horizontal',
  className,
  children,
  initialViews,
  router,
  ...props
}: TabsProps<T> & Omit<IssueViewsStateProviderProps, 'children'>) {
  return (
    <IssueViewsStateProvider initialViews={initialViews} router={router} {...props}>
      <TabsWrap orientation={orientation} className={className}>
        {children}
      </TabsWrap>
    </IssueViewsStateProvider>
  );
}

const TabsWrap = styled('div', {shouldForwardProp: tabsShouldForwardProp})<{
  orientation: Orientation;
}>`
  display: flex;
  flex-direction: ${p => (p.orientation === 'horizontal' ? 'column' : 'row')};
  flex-grow: 1;

  ${p =>
    p.orientation === 'vertical' &&
    `
      height: 100%;
      align-items: stretch;
    `};
`;
