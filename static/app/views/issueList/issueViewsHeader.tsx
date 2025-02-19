import {useContext, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Node} from '@react-types/shared';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {
  DraggableTabList,
  TEMPORARY_TAB_KEY,
} from 'sentry/components/draggableTabs/draggableTabList';
import type {DraggableTabListItemProps} from 'sentry/components/draggableTabs/item';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {IconMegaphone, IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {
  generateTempViewId,
  type IssueView,
  type IssueViewParams,
  IssueViews,
  IssueViewsContext,
} from 'sentry/views/issueList/issueViews/issueViews';
import {IssueViewTab} from 'sentry/views/issueList/issueViews/issueViewTab';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {NewTabContext} from 'sentry/views/issueList/utils/newTabContext';

import {IssueSortOptions} from './utils';

type IssueViewsIssueListHeaderProps = {
  onRealtimeChange: (realtime: boolean) => void;
  realtimeActive: boolean;
  router: InjectedRouter;
  selectedProjectIds: number[];
};

type IssueViewsIssueListHeaderTabsContentProps = {
  router: InjectedRouter;
};

function IssueViewsIssueListHeader({
  selectedProjectIds,
  realtimeActive,
  onRealtimeChange,
  router,
}: IssueViewsIssueListHeaderProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  const {newViewActive} = useContext(NewTabContext);

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: organization.slug,
  });

  const realtimeTitle = realtimeActive
    ? t('Pause real-time updates')
    : t('Enable real-time updates');

  const openForm = useFeedbackForm();
  const hasNewLayout = organization.features.includes('issue-stream-table-layout');

  return (
    <Layout.Header
      noActionWrap
      // No viewId in the URL query means that a temp view is selected, which has a dashed border
      borderStyle={
        groupSearchViews && !router?.location.query.viewId ? 'dashed' : 'solid'
      }
    >
      <Layout.HeaderContent>
        <Layout.Title>
          {t('Issues')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/issues/"
            title={t(
              'Detailed views of errors and performance problems in your application grouped by events with a similar set of characteristics.'
            )}
          />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          {openForm && hasNewLayout && (
            <Button
              size="sm"
              aria-label="issue-stream-feedback"
              icon={<IconMegaphone />}
              onClick={() =>
                openForm({
                  messagePlaceholder: t(
                    'How can we make the issue stream better for you?'
                  ),
                  tags: {
                    ['feedback.source']: 'new_issue_stream_layout',
                    ['feedback.owner']: 'issues',
                  },
                })
              }
            >
              {t('Give Feedback')}
            </Button>
          )}
          {!newViewActive && (
            <Button
              size="sm"
              data-test-id="real-time"
              title={realtimeTitle}
              aria-label={realtimeTitle}
              icon={realtimeActive ? <IconPause /> : <IconPlay />}
              onClick={() => onRealtimeChange(!realtimeActive)}
            />
          )}
        </ButtonBar>
      </Layout.HeaderActions>
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
      {groupSearchViews ? (
        <StyledIssueViews
          router={router}
          initialViews={groupSearchViews.map(
            (
              {id, name, query: viewQuery, querySort: viewQuerySort},
              index
            ): IssueView => {
              const tabId = id ?? `default${index.toString()}`;

              return {
                id: tabId,
                key: tabId,
                label: name,
                query: viewQuery,
                querySort: viewQuerySort,
                isCommitted: true,
              };
            }
          )}
        >
          <IssueViewsIssueListHeaderTabsContent router={router} />
        </StyledIssueViews>
      ) : (
        <div style={{height: 33}} />
      )}
    </Layout.Header>
  );
}

function IssueViewsIssueListHeaderTabsContent({
  router,
}: IssueViewsIssueListHeaderTabsContentProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilters = usePageFilters();
  const user = useUser();

  const {newViewActive, setNewViewActive} = useContext(NewTabContext);
  const {tabListState, state, dispatch} = useContext(IssueViewsContext);
  const {views, tempView} = state;

  const [editingTabKey, setEditingTabKey] = useState<string | null>(null);

  // TODO(msun): Use the location from useLocation instead of props router in the future
  const queryParams = router.location.query;
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

  // This useEffect is here temporarily to start saving user's most recently used page filters
  // to their views. This will be removed once the frontend is updated to use a view's page filters
  useEffect(() => {
    dispatch({type: 'SYNC_VIEWS_TO_BACKEND'});

    trackAnalytics('issue_views.page_filters_logged', {
      user_id: user.id,
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageFilters.selection]);

  // This insane useEffect ensures that the correct tab is selected when the url updates
  useEffect(() => {
    // If no query, sort, or viewId is present, set the first tab as the selected tab, update query accordingly
    if (!query && !sort && !viewId) {
      navigate(
        normalizeUrl({
          ...location,
          query: {
            ...queryParamsWithPageFilters,
            query: views[0]!.query,
            sort: views[0]!.querySort,
            viewId: views[0]!.id,
          },
        }),
        {replace: true}
      );
      tabListState?.setSelectedKey(views[0]!.key);
      return;
    }
    // if a viewId is present, check the frontend is aware of a view with that id.
    if (viewId) {
      const selectedView = views.find(tab => tab.id === viewId);
      if (selectedView) {
        // If the frontend is aware of a view with that id, check if the query/sort is different
        // from the view's original query/sort.
        const {query: originalQuery, querySort: originalSort} = selectedView;
        const issueSortOption = Object.values(IssueSortOptions).includes(sort)
          ? sort
          : IssueSortOptions.DATE;

        const newUnsavedChanges: IssueViewParams | undefined =
          query === originalQuery && sort === originalSort
            ? undefined
            : {
                query,
                querySort: issueSortOption,
              };
        if (
          (newUnsavedChanges && !selectedView.unsavedChanges) ||
          selectedView.unsavedChanges?.query !== newUnsavedChanges?.query ||
          selectedView.unsavedChanges?.querySort !== newUnsavedChanges?.querySort
        ) {
          // If there were no unsaved changes before, or the existing unsaved changes
          // don't match the new query and/or sort, update the unsaved changes
          dispatch({
            type: 'UPDATE_UNSAVED_CHANGES',
            unsavedChanges: newUnsavedChanges,
          });
        } else if (!newUnsavedChanges && selectedView.unsavedChanges) {
          // If the query/sort are the same as the original query/sort, remove any unsaved changes
          dispatch({type: 'UPDATE_UNSAVED_CHANGES', unsavedChanges: undefined});
        }
        if (!tabListState?.selectionManager.isSelected(selectedView.key)) {
          navigate(
            normalizeUrl({
              ...location,
              query: {
                ...queryParamsWithPageFilters,
                query: newUnsavedChanges?.query ?? selectedView.query,
                sort: newUnsavedChanges?.querySort ?? selectedView.querySort,
                viewId: selectedView.id,
              },
            }),
            {replace: true}
          );
          tabListState?.setSelectedKey(selectedView.key);
        }
      } else {
        // if a viewId does not exist, remove it from the query
        tabListState?.setSelectedKey(TEMPORARY_TAB_KEY);
        navigate(
          normalizeUrl({
            ...location,
            query: {
              ...queryParamsWithPageFilters,
              viewId: undefined,
            },
          }),
          {replace: true}
        );
        trackAnalytics('issue_views.shared_view_opened', {
          organization,
          query,
        });
      }
      return;
    }
    if (query) {
      if (!tabListState?.selectionManager.isSelected(TEMPORARY_TAB_KEY)) {
        dispatch({type: 'SET_TEMP_VIEW', query, sort});
        navigate(
          normalizeUrl({
            ...location,
            query: {
              ...queryParamsWithPageFilters,
              viewId: undefined,
            },
          }),
          {replace: true}
        );
        tabListState?.setSelectedKey(TEMPORARY_TAB_KEY);
        return;
      }
    }
  }, [
    navigate,
    organization.slug,
    query,
    sort,
    viewId,
    tabListState,
    location,
    queryParamsWithPageFilters,
    views,
    organization,
    dispatch,
  ]);

  // This useEffect ensures the "new view" page is displayed/hidden correctly
  useEffect(() => {
    if (viewId?.startsWith('_')) {
      if (views.find(tab => tab.id === viewId)?.isCommitted) {
        return;
      }
      // If the user types in query manually while the new view flow is showing,
      // then replace the add view flow with the issue stream with the query loaded,
      // and persist the query
      if (newViewActive && query !== '') {
        setNewViewActive(false);
        dispatch({
          type: 'UPDATE_UNSAVED_CHANGES',
          unsavedChanges: {query, querySort: sort ?? IssueSortOptions.DATE},
          isCommitted: true,
          syncViews: true,
        });
        trackAnalytics('issue_views.add_view.custom_query_saved', {
          organization,
          query,
        });
      } else {
        setNewViewActive(true);
      }
    } else {
      setNewViewActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, query]);

  const issuesViewSaveHotkeys = useMemo(() => {
    return [
      {
        match: ['command+s', 'ctrl+s'],
        includeInputs: true,
        callback: () => {
          if (views.find(tab => tab.key === tabListState?.selectedKey)?.unsavedChanges) {
            dispatch({type: 'SAVE_CHANGES', syncViews: true});
            addSuccessMessage(t('Changes saved to view'));
          }
        },
      },
    ];
  }, [dispatch, tabListState?.selectedKey, views]);

  useHotkeys(issuesViewSaveHotkeys);

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

  const allTabs = tempView ? [...views, tempView] : views;

  const initialTabKey =
    viewId && views.find(tab => tab.id === viewId)
      ? views.find(tab => tab.id === viewId)!.key
      : query
        ? TEMPORARY_TAB_KEY
        : views[0]!.key;

  return (
    <DraggableTabList
      onReorder={(newOrder: Array<Node<DraggableTabListItemProps>>) =>
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
      {allTabs.map(view => (
        <DraggableTabList.Item
          textValue={view.label}
          key={view.key}
          to={normalizeUrl({
            query: {
              ...queryParams,
              query: view.unsavedChanges?.query ?? view.query,
              sort: view.unsavedChanges?.querySort ?? view.querySort,
              viewId: view.id !== TEMPORARY_TAB_KEY ? view.id : undefined,
              cursor: undefined,
              page: undefined,
            },
            pathname: `/organizations/${organization.slug}/issues/`,
          })}
          disabled={view.key === editingTabKey}
        >
          <IssueViewTab
            key={view.key}
            view={view}
            initialTabKey={initialTabKey}
            router={router}
            editingTabKey={editingTabKey}
            setEditingTabKey={setEditingTabKey}
          />
        </DraggableTabList.Item>
      ))}
    </DraggableTabList>
  );
}

export default IssueViewsIssueListHeader;

const StyledIssueViews = styled(IssueViews)`
  grid-column: 1 / -1;
`;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;
