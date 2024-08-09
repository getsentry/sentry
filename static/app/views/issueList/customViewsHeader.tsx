import {useEffect, useState} from 'react';
import type {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import type {Node} from '@react-types/shared';
import {debounce} from 'lodash';

import type {DraggableTabListItemProps} from 'sentry/components/draggableTabs/item';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useProjects from 'sentry/utils/useProjects';
import {
  DraggableTabBar,
  type Tab,
} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabBar';
import {useUpdateGroupSearchViews} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViews';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

import type {IssueSortOptions, QueryCounts} from './utils';

type CustomViewsIssueListHeaderProps = {
  organization: Organization;
  queryCounts: QueryCounts;
  router: InjectedRouter;
  selectedProjectIds: number[];
  initalView?: GroupSearchView;
};

type CustomViewsIssueListHeaderTabsContentProps = {
  organization: Organization;
  query: string;
  queryCounts: QueryCounts;
  router: InjectedRouter;
  setBorderStyle: (borderStyle: 'dashed' | 'solid') => void;
  sort: IssueSortOptions;
  views: GroupSearchView[];
  defaultView?: string;
};

function CustomViewsIssueListHeader({...props}: CustomViewsIssueListHeaderProps) {
  const {projects} = useProjects();
  const selectedProjects = projects.filter(({id}) =>
    props.selectedProjectIds.includes(Number(id))
  );

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: props.organization.slug,
  });

  const {
    cursor: _cursor,
    page: _page,
    ...queryParams
  } = props.router?.location?.query ?? {};

  let defaultView: string | undefined = undefined;
  if (queryParams.viewId) {
    defaultView = queryParams.viewId;
  } else if (queryParams.query) {
    defaultView = 'temporary-tab';
  }

  const query = queryParams.query ?? props.initalView?.query;
  const sort = queryParams.sort ?? props.initalView?.querySort;

  const [borderStyle, setBorderStyle] = useState<'dashed' | 'solid'>(
    defaultView === 'temporary-tab' ? 'dashed' : 'solid'
  );

  return (
    <Layout.Header noActionWrap borderStyle={borderStyle}>
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
        <CustomViewsIssueListHeaderTabsContent
          {...props}
          query={query}
          sort={sort}
          views={groupSearchViews}
          setBorderStyle={setBorderStyle}
          defaultView={defaultView}
        />
      ) : (
        <div style={{height: 38}} />
      )}
    </Layout.Header>
  );
}

function CustomViewsIssueListHeaderTabsContent({
  organization,
  query,
  queryCounts,
  router,
  setBorderStyle,
  sort,
  views,
  defaultView,
}: CustomViewsIssueListHeaderTabsContentProps) {
  // Remove cursor and page when switching tabs
  const {cursor: _cursor, page: _page, ...queryParams} = router?.location?.query ?? {};
  const sortParam = queryParams.sort ?? sort;

  const viewsToTabs = views.map(
    ({id, name, query: viewQuery, querySort: viewQuerySort}, index): Tab => {
      return {
        id: id ?? undefined,
        key: `view-${index}`,
        label: name,
        query: viewQuery,
        querySort: viewQuerySort,
        queryCount: queryCounts[viewQuery]?.count ?? undefined,
        to: normalizeUrl({
          query: {
            ...queryParams,
            query: viewQuery,
            sort: viewQuerySort,
            ...(id ? {viewId: id} : {}),
          },
          pathname: `/organizations/${organization.slug}/issues/`,
        }),
      };
    }
  );

  let initialTabKey = viewsToTabs[0].key;
  if (defaultView === 'temporary-tab') {
    initialTabKey = 'temporary-tab';
  } else if (defaultView) {
    initialTabKey =
      viewsToTabs.find(tab => tab.id === defaultView)?.key ?? viewsToTabs[0].key;
  }

  const [draggableTabs, setDraggableTabs] = useState<Tab[]>(viewsToTabs);
  const [selectedTabKey, setSelectedTabKey] = useState<string>(initialTabKey);
  const [tempTab, setTempTab] = useState<Tab | undefined>(
    initialTabKey === 'temporary-tab'
      ? {
          key: 'temporary-tab',
          label: 'Unsaved',
          query,
          querySort: sortParam,
          to: normalizeUrl({
            query: {
              ...queryParams,
              query,
              sort: sortParam,
            },
            pathname: `/organizations/${organization.slug}/issues/`,
          }),
        }
      : undefined
  );

  const {mutate: updateViews} = useUpdateGroupSearchViews();

  const debounceUpdateViews = debounce(newTabs => {
    if (newTabs) {
      updateViews({
        orgSlug: organization.slug,
        groupSearchViews: newTabs.map(tab => ({
          id: tab.id,
          name: tab.label,
          query: tab.query,
          querySort: tab.querySort,
        })),
      });
    }
  }, 1000);

  // Update URL with view's query, sort, and id(?) upon initial render. Ideally
  // we can remove this after overview.tsx gets overhauled.
  useEffect(() => {
    router.replace(
      normalizeUrl({
        query: {
          ...queryParams,
          query: query,
          sort: sort,
          ...(draggableTabs[0]?.id ? {viewId: draggableTabs[0].id} : {}),
        },
        pathname: `/organizations/${organization.slug}/issues/`,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update local tabs when new views are received from mutation request
  useEffect(() => {
    setDraggableTabs(
      draggableTabs.map(tab => {
        if (!tab.id) {
          views.forEach(view => {
            if (
              tab.query === view.query &&
              tab.querySort === view.querySort &&
              tab.label === view.name
            ) {
              tab.id = view.id;
              tab.to = normalizeUrl({
                query: {
                  ...queryParams,
                  query: view.query,
                  sort: view.querySort,
                  viewId: view.id,
                },
                pathname: `/organizations/${organization.slug}/issues`,
              });
            }
          });
        }
        return tab;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  // Set parent component's bottem border to dashed if temp view is selected
  useEffect(() => {
    if (tempTab && selectedTabKey === 'temporary-tab') {
      setBorderStyle('dashed');
    } else {
      setBorderStyle('solid');
    }
  }, [tempTab, selectedTabKey, setBorderStyle]);

  // Updates the tab's hasSavedChanges state
  useEffect(() => {
    const currentTab = draggableTabs?.find(tab => tab.key === selectedTabKey);
    if (
      currentTab &&
      (query !== currentTab.query || sortParam !== currentTab.querySort)
    ) {
      // console.log(currentTab.query, query, currentTab.querySort, sortParam);
      setDraggableTabs(
        draggableTabs?.map(tab => {
          if (tab.key === selectedTabKey) {
            tab.unsavedChanges = [query, sortParam];
            tab.to = normalizeUrl({
              query: {
                ...queryParams,
                query,
                sort: sortParam,
                ...(tab.id ? {viewId: tab.id} : {}),
              },
              pathname: `/organizations/${organization.slug}/issues/`,
            });
          }
          return tab;
        })
      );
    } else if (
      currentTab &&
      query === currentTab.query &&
      sortParam === currentTab.querySort
    ) {
      setDraggableTabs(
        draggableTabs?.map(tab => {
          if (tab.key === selectedTabKey) {
            tab.unsavedChanges = undefined;
          }
          return tab;
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sortParam]);

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

  const onAddView = () => {
    const newKey = `view-${draggableTabs.length}`;
    const currentTab = draggableTabs.find(tab => tab.key === selectedTabKey);
    if (currentTab) {
      const newTabQuery = currentTab.unsavedChanges
        ? currentTab.unsavedChanges[0]
        : currentTab.query;
      const newTabSort = currentTab.unsavedChanges
        ? currentTab.unsavedChanges[1]
        : currentTab.querySort;
      const newDraggableTabs = [
        ...draggableTabs,
        {
          key: newKey,
          label: 'New View',
          query: newTabQuery,
          querySort: newTabSort,
          queryCount: queryCounts[query]?.count ?? 0,
          to: normalizeUrl({
            query: {
              ...queryParams,
              query: newTabQuery,
              sort: newTabSort,
              ...(currentTab.id ? {viewId: currentTab.id} : {}),
            },
            pathname: `/organizations/${organization.slug}/issues/`,
          }),
        },
      ];
      debounceUpdateViews(newDraggableTabs);
      setDraggableTabs(newDraggableTabs);
      setSelectedTabKey(newKey);
    }
  };

  const onDeleteView = (key: string) => {
    const newDraggableTabs = draggableTabs.filter(tab => tab.key !== key);
    debounceUpdateViews(newDraggableTabs);
    setDraggableTabs(newDraggableTabs);
  };

  const onDiscardChanges = (key: string) => {
    if (draggableTabs) {
      const originalTab = draggableTabs.find(tab => tab.key === key);
      if (originalTab?.to) {
        originalTab.unsavedChanges = undefined;
        originalTab.to = normalizeUrl({
          query: {
            ...queryParams,
            query: originalTab.query,
            sort: originalTab.querySort,
            ...(originalTab.id ? {viewId: originalTab.id} : {}),
          },
          pathname: `/organizations/${organization.slug}/issues/`,
        });
        router.push(originalTab.to);
      }
    }
  };

  const onDuplicateView = (key: string) => {
    const idx = draggableTabs.findIndex(tab => tab.key === key);
    const duplicatedTab = draggableTabs[idx];
    if (idx !== -1) {
      const newDraggableTabs = [
        ...draggableTabs.slice(0, idx + 1),
        {
          ...duplicatedTab,
          key: `view-${idx + 1}`,
          label: `${duplicatedTab.label} (Copy)`,
        },
        ...draggableTabs
          .slice(idx + 1)
          .map((tab, i) => ({...tab, key: `view-${idx + 2 + i}`})),
      ];
      debounceUpdateViews(newDraggableTabs);
      setDraggableTabs(newDraggableTabs);
      setSelectedTabKey(`view-${idx + 1}`);
    }
  };

  const onSaveChanges = (key: string) => {
    const newDraggableTabs = draggableTabs.map(tab => {
      if (tab.key === key) {
        tab.query = tab.unsavedChanges?.[0] ?? query;
        tab.querySort = tab.unsavedChanges?.[1] ?? sortParam;
        tab.unsavedChanges = undefined;
      }
      return tab;
    });
    debounceUpdateViews(newDraggableTabs);
    setDraggableTabs(newDraggableTabs);
  };

  const onRenamedView = (key: string, newLabel: string) => {
    const newDraggableTabs = draggableTabs.map(tab => {
      if (tab.key === key) {
        tab.label = newLabel;
      }
      return tab;
    });
    debounceUpdateViews(newDraggableTabs);
    setDraggableTabs(newDraggableTabs);
  };

  const onSaveTempView = () => {
    if (tempTab) {
      const newKey = `view-${draggableTabs.length}`;
      const newDraggableTabs = [
        ...draggableTabs,
        {
          key: newKey,
          label: 'New View',
          query: tempTab.query,
          querySort: tempTab.querySort,
          queryCount: queryCounts[query]?.count ?? 0,
          to: normalizeUrl({
            query: {
              ...queryParams,
              query: tempTab.query,
              sort: tempTab.querySort,
            },
            pathname: `/organizations/${organization.slug}/issues/`,
          }),
        },
      ];
      debounceUpdateViews(newDraggableTabs);
      setDraggableTabs(newDraggableTabs);
      setSelectedTabKey(newKey);
    }
    setTempTab(undefined);
  };

  const onDiscardTempView = () => {
    setTempTab(undefined);
    if (draggableTabs?.[0].to) {
      setSelectedTabKey(draggableTabs[0].key);
      router.push(draggableTabs[0].to);
    }
  };

  const onReorder = (newOrder: Node<DraggableTabListItemProps>[]) => {
    const newDraggableTabs = newOrder
      .map(node => {
        const foundTab = draggableTabs.find(tab => tab.key === node.key);
        return foundTab?.key === node.key ? foundTab : null;
      })
      .filter(defined);

    debounceUpdateViews(newDraggableTabs);
    setDraggableTabs(newDraggableTabs);
  };

  return (
    <StyledDraggableTabBar
      selectedTabKey={selectedTabKey}
      setSelectedTabKey={setSelectedTabKey}
      tabs={draggableTabs}
      setTabs={setDraggableTabs}
      showTempTab={tempTab !== undefined}
      tempTab={tempTab}
      onReorder={onReorder}
      onAddView={onAddView}
      onDelete={onDeleteView}
      onDiscard={onDiscardChanges}
      onDuplicate={onDuplicateView}
      onTabRenamed={onRenamedView}
      onSave={onSaveChanges}
      onDiscardTempView={onDiscardTempView}
      onSaveTempView={onSaveTempView}
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

const StyledDraggableTabBar = styled(DraggableTabBar)`
  border: none;
  font: Rubik;
`;
