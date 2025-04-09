import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import Redirect from 'sentry/components/redirect';
import SearchBar from 'sentry/components/searchBar';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {IssueViewsTable} from 'sentry/views/issueList/issueViews/issueViewsList/issueViewsTable';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {
  GroupSearchViewCreatedBy,
  GroupSearchViewSort,
} from 'sentry/views/issueList/types';

type IssueViewSectionProps = {
  createdBy: GroupSearchViewCreatedBy;
  cursorQueryParam: string;
  limit: number;
};

function useIssueViewSort(): GroupSearchViewSort {
  const location = useLocation();
  const sort = location.query.sort ?? GroupSearchViewSort.VISITED_DESC;

  return sort as GroupSearchViewSort;
}

function IssueViewSection({createdBy, limit, cursorQueryParam}: IssueViewSectionProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const sort = useIssueViewSort();
  const cursor =
    typeof location.query[cursorQueryParam] === 'string'
      ? location.query[cursorQueryParam]
      : undefined;

  const {
    data: views = [],
    isPending,
    isError,
    getResponseHeader,
  } = useFetchGroupSearchViews({
    orgSlug: organization.slug,
    createdBy,
    limit,
    sort,
    cursor,
  });

  const pageLinks = getResponseHeader?.('Link');

  return (
    <Fragment>
      <IssueViewsTable views={views} isPending={isPending} isError={isError} />
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
          query: {sort: newSort.value},
        });
      }}
      options={[
        {
          label: t('Recently Viewed'),
          value: GroupSearchViewSort.VISITED_DESC,
        },
        {
          label: t('Most Starred'),
          value: GroupSearchViewSort.POPULARITY_DESC,
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

  if (!organization.features.includes('issue-view-sharing')) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <Layout.Page>
      <Layout.Header unified>
        <Layout.Title>{t('All Views')}</Layout.Title>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <FilterSortBar>
            <SearchBar
              defaultQuery={query}
              onSearch={newQuery => {
                navigate({
                  pathname: location.pathname,
                  query: {query: newQuery},
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
