import {useContext, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {Tabs, TabsContext} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import {
  DraggableTabBar,
  type Tab,
} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabBar';
import {useUpdateGroupSearchViews} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViews';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {UpdateGroupSearchViewPayload} from 'sentry/views/issueList/types';

import {IssueSortOptions} from './utils';

type CustomViewsIssueListHeaderProps = {
  organization: Organization;
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
      <Layout.HeaderActions />
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
      {groupSearchViews ? (
        <Tabs>
          <CustomViewsIssueListHeaderTabsContent {...props} views={groupSearchViews} />
        </Tabs>
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

  // TODO(msun): Use the location from useLocation instead of props router in the future
  const {cursor: _cursor, page: _page, ...queryParams} = router?.location.query;
  const {query, sort, viewId} = queryParams;

  const viewsToTabs = views.map(
    ({id, name, query: viewQuery, querySort: viewQuerySort}, index): Tab => {
      const tabId = id ?? `default${index.toString()}`;
      return {
        id: tabId,
        key: tabId,
        label: name,
        query: viewQuery,
        querySort: viewQuerySort,
      };
    }
  );

  const [draggableTabs, setDraggableTabs] = useState<Tab[]>(viewsToTabs);

  const {tabListState} = useContext(TabsContext);

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

  // TODO: Try to remove this state if possible
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
              // Do not send over an ID if it's a temporary or default tab so that
              // the backend will save these and generate permanent Ids for them
              ...(tab.id[0] !== '_' && !tab.id.startsWith('default') ? {id: tab.id} : {}),
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
        {
          ...location,
          query: {
            ...queryParams,
            query: draggableTabs[0].query,
            sort: draggableTabs[0].querySort,
            viewId: draggableTabs[0].id,
          },
        },
        {replace: true}
      );
      tabListState?.setSelectedKey(draggableTabs[0].key);
      return;
    }
    // if a viewId is present, check if it exists in the existing views.
    if (viewId) {
      const selectedTab = draggableTabs.find(tab => tab.id === viewId);
      if (selectedTab && query && sort) {
        const issueSortOption = Object.values(IssueSortOptions).includes(sort)
          ? sort
          : IssueSortOptions.DATE;

        const unsavedChanges: [string, IssueSortOptions] | undefined =
          query === selectedTab.query && sort === selectedTab.querySort
            ? undefined
            : [query as string, issueSortOption];

        setDraggableTabs(
          draggableTabs.map(tab =>
            tab.key === selectedTab!.key
              ? {
                  ...tab,
                  unsavedChanges,
                }
              : tab
          )
        );

        tabListState?.setSelectedKey(selectedTab.key);
        return;
      }
      if (selectedTab && query === undefined) {
        navigate({
          ...location,
          query: {
            ...queryParams,
            query: selectedTab.query,
            sort: selectedTab.querySort,
            viewId: selectedTab.id,
          },
        });
        tabListState?.setSelectedKey(selectedTab.key);
        return;
      }
      if (!selectedTab) {
        // if a viewId does not exist, remove it from the query
        tabListState?.setSelectedKey('temporary-tab');
        navigate({
          ...location,
          query: {
            ...queryParams,
            viewId: undefined,
          },
        });
        return;
      }
      return;
    }
    if (query) {
      tabListState?.setSelectedKey('temporary-tab');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, organization.slug, query, sort, viewId]);

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
            ...location,
            query: {
              ...queryParams,
              viewId: tab.id,
            },
          });
        }
        return tab;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

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

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;
