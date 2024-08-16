import {useEffect, useMemo, useState} from 'react';
import type {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {debounce} from 'lodash';

import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import {
  DraggableTabBar,
  type Tab,
} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabBar';
import {useUpdateGroupSearchViews} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViews';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {UpdateGroupSearchViewPayload} from 'sentry/views/issueList/types';

import {IssueSortOptions, type QueryCounts} from './utils';

type CustomViewsIssueListHeaderProps = {
  organization: Organization;
  queryCounts: QueryCounts;
  router: InjectedRouter;
  selectedProjectIds: number[];
};

type CustomViewsIssueListHeaderTabsContentProps = {
  organization: Organization;
  queryCounts: QueryCounts;
  router: InjectedRouter;
  views: UpdateGroupSearchViewPayload[];
};

function CustomViewsIssueListHeader({
  selectedProjectIds,
  ...props
}: CustomViewsIssueListHeaderProps) {
  const {projects} = useProjects();
  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: props.organization.slug,
  });

  return (
    <Layout.Header
      noActionWrap
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
      <Layout.HeaderActions />
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
      {groupSearchViews ? (
        <CustomViewsIssueListHeaderTabsContent {...props} views={groupSearchViews} />
      ) : (
        <div style={{height: 33}} />
      )}
    </Layout.Header>
  );
}

function CustomViewsIssueListHeaderTabsContent({
  organization,
  queryCounts,
  router,
  views,
}: CustomViewsIssueListHeaderTabsContentProps) {
  // Remove cursor and page when switching tabs
  const navigate = useNavigate();

  // TODO: Replace this with useLocation
  const {cursor: _cursor, page: _page, ...queryParams} = router?.location.query;

  const viewsToTabs = views.map(
    ({id, name, query: viewQuery, querySort: viewQuerySort}, index): Tab => {
      const tabId = id ?? `default${index}`;
      return {
        id: tabId,
        key: tabId,
        label: name,
        query: viewQuery,
        querySort: viewQuerySort,
        queryCount: queryCounts[viewQuery]?.count ?? undefined,
      };
    }
  );

  const [draggableTabs, setDraggableTabs] = useState<Tab[]>(viewsToTabs);

  const {query, sort, viewId} = queryParams;
  const getInitialTabKey = () => {
    if (draggableTabs[0].key.startsWith('default')) {
      return draggableTabs[0].key;
    }
    if (!query && !sort && !viewId) {
      return draggableTabs[0].key;
    }
    if (viewId && draggableTabs.find(tab => tab.id === viewId)) {
      return draggableTabs.find(tab => tab.id === viewId)!.key;
    }
    if (query) {
      return 'temporary-tab';
    }
    return draggableTabs[0].key;
  };

  // TODO: infer selected tab key state from URL params
  const [selectedTabKey, setSelectedTabKey] = useState<string>(getInitialTabKey());
  const [tempTab, setTempTab] = useState<Tab | undefined>(
    getInitialTabKey() === 'temporary-tab' && query
      ? {
          id: 'temporary-tab',
          key: 'temporary-tab',
          label: t('Unsaved'),
          query: query,
          querySort: sort ?? IssueSortOptions.DATE,
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
            groupSearchViews: newTabs.map(tab => ({
              // Do not send over an ID if it's a temporary id
              ...(tab.id[0] !== '_' ? {id: tab.id} : {}),
              name: tab.label,
              query: tab.query,
              querySort: tab.querySort,
            })),
          });
        }
      }, 500),
    [organization.slug, updateViews]
  );

  useEffect(() => {
    // If no query, sort, or viewId is present, set the first tab as the selected tab, update query accordingly
    if (!query && !sort && !viewId) {
      navigate({
        query: {
          ...queryParams,
          query: draggableTabs[0].query,
          sort: draggableTabs[0].querySort,
          viewId: draggableTabs[0].id,
        },
        pathname: `/organizations/${organization.slug}/issues/`,
      });
      return;
    }
    // if a viewId is present, check if it exists in the existing views.
    if (viewId) {
      const selectedTab = draggableTabs.find(tab => tab.id === viewId);
      if (
        selectedTab &&
        (query !== selectedTab!.query || sort !== selectedTab!.querySort)
      ) {
        // if a viewId exists but the query and sort are not what we expected, set them as unsaved changes
        setDraggableTabs(
          draggableTabs.map(tab =>
            tab.key === selectedTab!.key
              ? {
                  ...tab,
                  unsavedChanges: [query, sort],
                }
              : tab
          )
        );
      } else if (!selectedTab) {
        // if a viewId does not exist, remove it from the query
        navigate({
          query: {
            ...queryParams,
            viewId: undefined,
          },
          pathname: `/organizations/${organization.slug}/issues/`,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update local tabs when new views are received from mutation request
  useEffect(() => {
    setDraggableTabs(
      draggableTabs.map(tab => {
        if (tab.id && tab.id[0] === '_') {
          // Temp viewIds are prefixed with '_'
          views.forEach(view => {
            if (
              view.id &&
              tab.query === view.query &&
              tab.querySort === view.querySort &&
              tab.label === view.name
            ) {
              tab.id = view.id;
            }
          });
          navigate({
            query: {
              ...queryParams,
              viewId: tab.id,
            },
            pathname: `/organizations/${organization.slug}/issues/`,
          });
        }
        return tab;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  // Updates the tab's hasSavedChanges state
  useEffect(() => {
    const currentTab = draggableTabs?.find(tab => tab.key === selectedTabKey);
    if (currentTab && (query !== currentTab.query || sort !== currentTab.querySort)) {
      setDraggableTabs(
        draggableTabs?.map(tab => {
          return tab.key === selectedTabKey
            ? {...tab, unsavedChanges: [query, sort]}
            : tab;
        })
      );
    } else if (
      currentTab &&
      query === currentTab.query &&
      sort === currentTab.querySort
    ) {
      setDraggableTabs(
        draggableTabs?.map(tab => {
          return tab.key === selectedTabKey ? {...tab, unsavedChanges: undefined} : tab;
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort]);

  // Loads query counts when they are available
  useEffect(() => {
    setDraggableTabs(
      draggableTabs?.map(tab => {
        if (tab.query && queryCounts[tab.query]) {
          tab.queryCount = queryCounts[tab.query]?.count ?? 0; // TODO: Confirm null = 0 is correct
        }
        return tab;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryCounts]);

  return (
    <DraggableTabBar
      selectedTabKey={selectedTabKey}
      setSelectedTabKey={setSelectedTabKey}
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

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;
