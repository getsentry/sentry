import {useContext, useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
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
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {IconMegaphone, IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  generateTempViewId,
  type IssueView,
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
          <IssueViewsIssueListHeaderTabsContent />
        </StyledIssueViews>
      ) : (
        <div style={{height: 33}} />
      )}
    </Layout.Header>
  );
}

function IssueViewsIssueListHeaderTabsContent() {
  const organization = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const {query, sort, viewId} = Object.fromEntries(searchParams);

  const {newViewActive, setNewViewActive} = useContext(NewTabContext);
  const {tabListState, state, dispatch} = useContext(IssueViewsContext);
  const {views, tempView} = state;

  const [editingTabKey, setEditingTabKey] = useState<string | null>(null);

  // This insane useEffect ensures that the correct tab is selected when the url updates
  useEffect(() => {
    // If no query, sort, or viewId is present, set the first tab as the selected tab, update query accordingly
    if (!query && !sort && !viewId) {
      setSearchParams(
        prev => {
          prev.set('query', views[0]!.query);
          prev.set('sort', views[0]!.querySort);
          prev.set('viewId', views[0]!.id);
          return prev;
        },
        {replace: true}
      );
      tabListState?.setSelectedKey(views[0]!.key);
      return;
    }
    // if a viewId is present, check if it exists in the existing views.
    if (viewId) {
      const selectedTab = views.find(tab => tab.id === viewId);
      if (selectedTab) {
        const issueSortOption = Object.values(IssueSortOptions).includes(
          sort as IssueSortOptions
        )
          ? sort
          : IssueSortOptions.DATE;

        const newUnsavedChanges: [string, IssueSortOptions] | undefined =
          query === selectedTab.query && sort === selectedTab.querySort
            ? undefined
            : [query ?? selectedTab.query, issueSortOption as IssueSortOptions];
        if (
          (newUnsavedChanges && !selectedTab.unsavedChanges) ||
          selectedTab.unsavedChanges?.[0] !== newUnsavedChanges?.[0] ||
          selectedTab.unsavedChanges?.[1] !== newUnsavedChanges?.[1]
        ) {
          // If there were no unsaved changes before, or the existing unsaved changes
          // don't match the new query and/or sort, update the unsaved changes
          dispatch({
            type: 'UPDATE_UNSAVED_CHANGES',
            unsavedChanges: newUnsavedChanges,
          });
        } else if (!newUnsavedChanges && selectedTab.unsavedChanges) {
          // If there are no longer unsaved changes but there were before, remove them
          dispatch({type: 'UPDATE_UNSAVED_CHANGES', unsavedChanges: undefined});
        }
        if (!tabListState?.selectionManager.isSelected(selectedTab.key)) {
          setSearchParams(
            prev => {
              prev.set(
                'query',
                newUnsavedChanges ? newUnsavedChanges[0] : selectedTab.query
              );
              prev.set(
                'sort',
                newUnsavedChanges ? newUnsavedChanges[1] : selectedTab.querySort
              );
              prev.set('viewId', selectedTab.id);
              return prev;
            },
            {replace: true}
          );
          tabListState?.setSelectedKey(selectedTab.key);
        }
      } else {
        // if a viewId does not exist, remove it from the query
        tabListState?.setSelectedKey(TEMPORARY_TAB_KEY);
        setSearchParams(
          prev => {
            prev.delete('viewId');
            return prev;
          },
          {replace: true}
        );
        trackAnalytics('issue_views.shared_view_opened', {
          organization,
          query: query ?? '',
        });
      }
      return;
    }
    if (query) {
      if (!tabListState?.selectionManager.isSelected(TEMPORARY_TAB_KEY)) {
        dispatch({type: 'SET_TEMP_VIEW', query, sort: sort as IssueSortOptions});
        setSearchParams(
          prev => {
            prev.set('viewId', TEMPORARY_TAB_KEY);
            return prev;
          },
          {replace: true}
        );
        tabListState?.setSelectedKey(TEMPORARY_TAB_KEY);
        return;
      }
    }
  }, [
    organization.slug,
    query,
    sort,
    viewId,
    tabListState,
    views,
    organization,
    dispatch,
    setSearchParams,
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
      if (newViewActive && query && query !== '') {
        setNewViewActive(false);
        dispatch({
          type: 'UPDATE_UNSAVED_CHANGES',
          unsavedChanges: [query, (sort as IssueSortOptions) ?? IssueSortOptions.DATE],
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

  useHotkeys(
    [
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
    ],
    [dispatch, tabListState?.selectedKey, views]
  );

  const handleCreateNewView = () => {
    const tempId = generateTempViewId();
    dispatch({type: 'CREATE_NEW_VIEW', tempId});
    tabListState?.setSelectedKey(tempId);
    setSearchParams(prev => {
      prev.set('query', '');
      prev.set('viewId', tempId);
      return prev;
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
      {allTabs.map(view => (
        <DraggableTabList.Item
          textValue={view.label}
          key={view.key}
          to={normalizeUrl({
            query: {
              query: view.unsavedChanges?.[0] ?? view.query,
              sort: view.unsavedChanges?.[1] ?? view.querySort,
              viewId: view.id !== TEMPORARY_TAB_KEY ? view.id : undefined,
            },
            pathname: `/organizations/${organization.slug}/issues/`,
          })}
          disabled={view.key === editingTabKey}
        >
          <IssueViewTab
            key={view.key}
            view={view}
            initialTabKey={initialTabKey}
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
