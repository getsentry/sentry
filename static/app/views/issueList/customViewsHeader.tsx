import {useContext, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {TEMPORARY_TAB_KEY} from 'sentry/components/draggableTabs/draggableTabList';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {Tabs, TabsContext} from 'sentry/components/tabs';
import {IconMegaphone, IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {
  DraggableTabBar,
  type Tab,
} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabBar';
import {useUpdateGroupSearchViews} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViews';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {UpdateGroupSearchViewPayload} from 'sentry/views/issueList/types';
import {NewTabContext} from 'sentry/views/issueList/utils/newTabContext';

import {IssueSortOptions} from './utils';

type CustomViewsIssueListHeaderProps = {
  onRealtimeChange: (realtime: boolean) => void;
  organization: Organization;
  realtimeActive: boolean;
  router: InjectedRouter;
  selectedProjectIds: number[];
};

type CustomViewsIssueListHeaderTabsContentProps = {
  organization: Organization;
  router: InjectedRouter;
  views: UpdateGroupSearchViewPayload[];
};

function CustomViewsIssueListHeader({
  selectedProjectIds,
  realtimeActive,
  onRealtimeChange,
  ...props
}: CustomViewsIssueListHeaderProps) {
  const {projects} = useProjects();
  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: props.organization.slug,
  });

  const realtimeTitle = realtimeActive
    ? t('Pause real-time updates')
    : t('Enable real-time updates');

  const {newViewActive} = useContext(NewTabContext);

  const openForm = useFeedbackForm();
  const hasNewLayout = props.organization.features.includes('issue-stream-table-layout');

  return (
    <Layout.Header
      noActionWrap
      // No viewId in the URL query means that a temp view is selected, which has a dashed border
      borderStyle={
        groupSearchViews && !props.router?.location.query.viewId ? 'dashed' : 'solid'
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
        <StyledTabs>
          <CustomViewsIssueListHeaderTabsContent {...props} views={groupSearchViews} />
        </StyledTabs>
      ) : (
        <div style={{height: 33}} />
      )}
    </Layout.Header>
  );
}

function CustomViewsIssueListHeaderTabsContent({
  organization,
  router,
  views,
}: CustomViewsIssueListHeaderTabsContentProps) {
  // TODO(msun): Possible replace navigate with useSearchParams() in the future?
  const navigate = useNavigate();
  const location = useLocation();
  const {setNewViewActive, newViewActive} = useContext(NewTabContext);
  const pageFilters = usePageFilters();

  // TODO(msun): Use the location from useLocation instead of props router in the future
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

  const [draggableTabs, setDraggableTabs] = useState<Tab[]>(
    views.map(({id, name, query: viewQuery, querySort: viewQuerySort}, index): Tab => {
      const tabId = id ?? `default${index.toString()}`;

      return {
        id: tabId,
        key: tabId,
        label: name,
        query: viewQuery,
        querySort: viewQuerySort,
        unsavedChanges: undefined,
        isCommitted: true,
      };
    })
  );

  const getInitialTabKey = () => {
    if (viewId && draggableTabs.find(tab => tab.id === viewId)) {
      return draggableTabs.find(tab => tab.id === viewId)!.key;
    }
    if (query) {
      return TEMPORARY_TAB_KEY;
    }
    return draggableTabs[0].key;
  };

  const {tabListState} = useContext(TabsContext);

  // TODO: Try to remove this state if possible
  const [tempTab, setTempTab] = useState<Tab | undefined>(
    getInitialTabKey() === TEMPORARY_TAB_KEY && query
      ? {
          id: TEMPORARY_TAB_KEY,
          key: TEMPORARY_TAB_KEY,
          label: t('Unsaved'),
          query,
          querySort: sort ?? IssueSortOptions.DATE,
          isCommitted: true,
        }
      : undefined
  );

  const {mutate: updateViews} = useUpdateGroupSearchViews();

  const debounceUpdateViews = useMemo(
    () =>
      debounce((newTabs: Tab[]) => {
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

  // This insane useEffect ensures that the correct tab is selected when the url updates
  useEffect(() => {
    // If no query, sort, or viewId is present, set the first tab as the selected tab, update query accordingly
    if (!query && !sort && !viewId) {
      navigate(
        normalizeUrl({
          ...location,
          query: {
            ...queryParamsWithPageFilters,
            query: draggableTabs[0].query,
            sort: draggableTabs[0].querySort,
            viewId: draggableTabs[0].id,
          },
        }),
        {replace: true}
      );
      tabListState?.setSelectedKey(draggableTabs[0].key);
      return;
    }
    // if a viewId is present, check if it exists in the existing views.
    if (viewId) {
      const selectedTab = draggableTabs.find(tab => tab.id === viewId);
      if (selectedTab) {
        const issueSortOption = Object.values(IssueSortOptions).includes(sort)
          ? sort
          : IssueSortOptions.DATE;

        const newUnsavedChanges: [string, IssueSortOptions] | undefined =
          query === selectedTab.query && sort === selectedTab.querySort
            ? undefined
            : [query ?? selectedTab.query, issueSortOption];
        if (
          (newUnsavedChanges && !selectedTab.unsavedChanges) ||
          selectedTab.unsavedChanges?.[0] !== newUnsavedChanges?.[0] ||
          selectedTab.unsavedChanges?.[1] !== newUnsavedChanges?.[1]
        ) {
          // If there were no unsaved changes before, or the existing unsaved changes
          // don't match the new query and/or sort, update the unsaved changes
          setDraggableTabs(
            draggableTabs.map(tab =>
              tab.key === selectedTab.key
                ? {
                    ...tab,
                    unsavedChanges: newUnsavedChanges,
                  }
                : tab
            )
          );
        } else if (!newUnsavedChanges && selectedTab.unsavedChanges) {
          // If there are no longer unsaved changes but there were before, remove them
          setDraggableTabs(
            draggableTabs.map(tab =>
              tab.key === selectedTab.key
                ? {
                    ...tab,
                    unsavedChanges: undefined,
                  }
                : tab
            )
          );
        }

        if (!tabListState?.selectionManager.isSelected(selectedTab.key)) {
          navigate(
            normalizeUrl({
              ...location,
              query: {
                ...queryParamsWithPageFilters,
                query: newUnsavedChanges ? newUnsavedChanges[0] : selectedTab.query,
                sort: newUnsavedChanges ? newUnsavedChanges[1] : selectedTab.querySort,
                viewId: selectedTab.id,
              },
            }),
            {replace: true}
          );
          tabListState?.setSelectedKey(selectedTab.key);
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
        tabListState?.setSelectedKey(TEMPORARY_TAB_KEY);
        setTempTab({
          id: TEMPORARY_TAB_KEY,
          key: TEMPORARY_TAB_KEY,
          label: t('Unsaved'),
          query,
          querySort: sort ?? IssueSortOptions.DATE,
          isCommitted: true,
        });
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
    draggableTabs,
    organization,
  ]);

  // Update local tabs when new views are received from mutation request
  useEffectAfterFirstRender(() => {
    const newlyCreatedViews = views.filter(
      view => !draggableTabs.find(tab => tab.id === view.id)
    );
    const currentView = draggableTabs.find(tab => tab.id === viewId);

    setDraggableTabs(oldDraggableTabs => {
      const assignedIds = new Set();
      return oldDraggableTabs.map(tab => {
        // Temp viewIds are prefixed with '_'
        if (tab.id && tab.id[0] === '_') {
          const matchingView = newlyCreatedViews.find(
            view =>
              view.id &&
              !assignedIds.has(view.id) &&
              tab.query === view.query &&
              tab.querySort === view.querySort &&
              tab.label === view.name
          );
          if (matchingView?.id) {
            assignedIds.add(matchingView.id);
            return {
              ...tab,
              id: matchingView.id,
            };
          }
        }
        return tab;
      });
    });

    if (viewId?.startsWith('_') && currentView) {
      const matchingView = newlyCreatedViews.find(
        view =>
          view.id &&
          currentView.query === view.query &&
          currentView.querySort === view.querySort &&
          currentView.label === view.name
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  useEffect(() => {
    if (viewId?.startsWith('_')) {
      if (draggableTabs.find(tab => tab.id === viewId)?.isCommitted) {
        return;
      }
      // If the user types in query manually while the new view flow is showing,
      // then replace the add view flow with the issue stream with the query loaded,
      // and persist the query
      if (newViewActive && query !== '') {
        setNewViewActive(false);
        const updatedTabs: Tab[] = draggableTabs.map(tab =>
          tab.id === viewId
            ? {
                ...tab,
                unsavedChanges: [query, sort ?? IssueSortOptions.DATE],
                isCommitted: true,
              }
            : tab
        );
        setDraggableTabs(updatedTabs);
        debounceUpdateViews(updatedTabs);
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

  return (
    <DraggableTabBar
      initialTabKey={getInitialTabKey()}
      tabs={draggableTabs}
      setTabs={setDraggableTabs}
      tempTab={tempTab}
      setTempTab={setTempTab}
      orgSlug={organization.slug}
      onReorder={debounceUpdateViews}
      onAddView={debounceUpdateViews}
      onDelete={debounceUpdateViews}
      onDuplicate={debounceUpdateViews}
      onTabRenamed={newTabs => debounceUpdateViews(newTabs)}
      onSave={debounceUpdateViews}
      onSaveTempView={debounceUpdateViews}
      router={router}
    />
  );
}

export default CustomViewsIssueListHeader;

const StyledTabs = styled(Tabs)`
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
