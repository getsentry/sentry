import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import Redirect from 'sentry/components/redirect';
import SearchBar from 'sentry/components/searchBar';
import {IconAdd, IconMegaphone, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import {unreachable} from 'sentry/utils/unreachable';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {IssueViewsTable} from 'sentry/views/issueList/issueViews/issueViewsList/issueViewsTable';
import {useDeleteGroupSearchView} from 'sentry/views/issueList/mutations/useDeleteGroupSearchView';
import {useUpdateGroupSearchViewStarred} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarred';
import type {GroupSearchViewBackendSortOption} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {
  makeFetchGroupSearchViewsKey,
  useFetchGroupSearchViews,
} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {
  type GroupSearchView,
  GroupSearchViewCreatedBy,
  GroupSearchViewSort,
} from 'sentry/views/issueList/types';

type IssueViewSectionProps = {
  createdBy: GroupSearchViewCreatedBy;
  cursorQueryParam: string;
  limit: number;
};

// We expose a few simplified sort options which are mapped to multiple
// backend sorts to provide the best results.
function getEndpointSort(
  sort: GroupSearchViewSort = GroupSearchViewSort.POPULARITY
): GroupSearchViewBackendSortOption[] {
  switch (sort) {
    case GroupSearchViewSort.POPULARITY:
      return ['-popularity', '-visited', '-created'];
    case GroupSearchViewSort.NAME_ASC:
      return ['name', '-visited', '-created'];
    case GroupSearchViewSort.NAME_DESC:
      return ['-name', '-visited', '-created'];
    case GroupSearchViewSort.VIEWED:
      return ['-visited', '-popularity', '-created'];
    default:
      unreachable(sort);
      return [];
  }
}

function useIssueViewSort(): GroupSearchViewSort {
  const location = useLocation();
  const sort = location.query.sort ?? GroupSearchViewSort.POPULARITY;

  return sort as GroupSearchViewSort;
}

function IssueViewSection({createdBy, limit, cursorQueryParam}: IssueViewSectionProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const sort = useIssueViewSort();
  const query = typeof location.query.query === 'string' ? location.query.query : '';
  const cursor =
    typeof location.query[cursorQueryParam] === 'string'
      ? location.query[cursorQueryParam]
      : undefined;
  const queryClient = useQueryClient();
  const endpointSort = getEndpointSort(sort);

  const {
    data: views = [],
    isPending,
    isError,
    getResponseHeader,
  } = useFetchGroupSearchViews(
    {
      orgSlug: organization.slug,
      createdBy,
      limit,
      sort: endpointSort,
      cursor,
      query,
    },
    {staleTime: 0}
  );

  const tableQueryKey = makeFetchGroupSearchViewsKey({
    orgSlug: organization.slug,
    createdBy,
    limit,
    cursor,
    sort: endpointSort,
    query,
  });

  const {mutate: mutateViewStarred} = useUpdateGroupSearchViewStarred({
    onMutate: variables => {
      setApiQueryData<GroupSearchView[]>(queryClient, tableQueryKey, data => {
        return data?.map(view =>
          view.id === variables.id ? {...view, starred: variables.starred} : view
        );
      });
    },
    onError: (_error, variables) => {
      setApiQueryData<GroupSearchView[]>(queryClient, tableQueryKey, data => {
        return data?.map(view =>
          view.id === variables.id ? {...view, starred: !variables.starred} : view
        );
      });
    },
  });
  const {mutate: deleteView} = useDeleteGroupSearchView({
    onMutate: variables => {
      setApiQueryData<GroupSearchView[]>(queryClient, tableQueryKey, data => {
        return data?.filter(v => v.id !== variables.id);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: tableQueryKey});
    },
  });

  const pageLinks = getResponseHeader?.('Link');

  return (
    <Fragment>
      <IssueViewsTable
        type={createdBy}
        views={views}
        isPending={isPending}
        isError={isError}
        handleStarView={view => {
          mutateViewStarred({id: view.id, starred: !view.starred, view});
        }}
        handleDeleteView={view => {
          deleteView({id: view.id});
        }}
        hideCreatedBy={createdBy === GroupSearchViewCreatedBy.ME}
      />
      <Pagination
        pageLinks={pageLinks}
        onCursor={newCursor => {
          navigate({
            pathname: location.pathname,
            query: {
              ...location.query,
              [cursorQueryParam]: newCursor,
            },
          });
        }}
      />
    </Fragment>
  );
}

function SortDropdown() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const sort = useIssueViewSort();

  return (
    <CompactSelect
      value={sort}
      triggerProps={{
        icon: <IconSort />,
      }}
      onChange={newSort => {
        trackAnalytics('issue_views.table.sort_changed', {
          organization,
          sort: newSort.value,
        });
        navigate({
          pathname: location.pathname,
          query: {...location.query, sort: newSort.value},
        });
      }}
      options={[
        {
          label: t('Most Starred'),
          value: GroupSearchViewSort.POPULARITY,
        },
        {
          label: t('Recently Viewed'),
          value: GroupSearchViewSort.VIEWED,
        },
        {
          label: t('Name (A-Z)'),
          value: GroupSearchViewSort.NAME_ASC,
        },
        {
          label: t('Name (Z-A)'),
          value: GroupSearchViewSort.NAME_DESC,
        },
      ]}
    />
  );
}

export default function IssueViewsList() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const query = typeof location.query.query === 'string' ? location.query.query : '';
  const openFeedbackForm = useFeedbackForm();

  if (!organization.features.includes('issue-view-sharing')) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <Layout.Page>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>{t('All Views')}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            {openFeedbackForm ? (
              <Button
                icon={<IconMegaphone />}
                size="sm"
                onClick={() => {
                  openFeedbackForm({
                    formTitle: t('Give Feedback'),
                    messagePlaceholder: t('How can we make issue views better for you?'),
                    tags: {
                      ['feedback.source']: 'custom_views',
                      ['feedback.owner']: 'issues',
                    },
                  });
                }}
              >
                {t('Give Feedback')}
              </Button>
            ) : null}
            <LinkButton
              to={`/organizations/${organization.slug}/issues/views/new/`}
              priority="primary"
              icon={<IconAdd />}
              size="sm"
              onClick={() => {
                trackAnalytics('issue_views.table.create_view_clicked', {
                  organization,
                });
              }}
            >
              {t('Create View')}
            </LinkButton>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <FilterSortBar>
            <SearchBar
              defaultQuery={query}
              onSearch={newQuery => {
                navigate({
                  pathname: location.pathname,
                  query: {...location.query, query: newQuery},
                });
              }}
              placeholder=""
            />
            <SortDropdown />
          </FilterSortBar>
          <TableHeading>{t('My Views')}</TableHeading>
          <IssueViewSection
            createdBy={GroupSearchViewCreatedBy.ME}
            limit={20}
            cursorQueryParam="mc"
          />
          <TableHeading>{t('Created by Others')}</TableHeading>
          <IssueViewSection
            createdBy={GroupSearchViewCreatedBy.OTHERS}
            limit={20}
            cursorQueryParam="sc"
          />
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

const FilterSortBar = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto;
  gap: ${space(1)};
`;

const TableHeading = styled('h2')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-top: ${space(3)};
  margin-bottom: ${space(1.5)};
`;
