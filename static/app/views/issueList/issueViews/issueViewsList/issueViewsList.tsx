import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import Redirect from 'sentry/components/redirect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {IssueViewsTable} from 'sentry/views/issueList/issueViews/issueViewsList/issueViewsTable';
import {useUpdateGroupSearchViewStarred} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarred';
import {
  makeFetchGroupSearchViewsKey,
  useFetchGroupSearchViews,
} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {
  type GroupSearchView,
  GroupSearchViewCreatedBy,
} from 'sentry/views/issueList/types';

type IssueViewSectionProps = {
  createdBy: GroupSearchViewCreatedBy;
  cursorQueryParam: string;
  limit: number;
};

function IssueViewSection({createdBy, limit, cursorQueryParam}: IssueViewSectionProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const cursor =
    typeof location.query[cursorQueryParam] === 'string'
      ? location.query[cursorQueryParam]
      : undefined;
  const queryClient = useQueryClient();

  const {
    data: views = [],
    isPending,
    isError,
    getResponseHeader,
  } = useFetchGroupSearchViews({
    orgSlug: organization.slug,
    createdBy,
    limit,
    cursor,
  });

  const {mutate: mutateViewStarred} = useUpdateGroupSearchViewStarred({
    onMutate: variables => {
      setApiQueryData<GroupSearchView[]>(
        queryClient,
        makeFetchGroupSearchViewsKey({
          orgSlug: organization.slug,
          createdBy,
          limit,
          cursor,
        }),
        data => {
          return data?.map(view =>
            view.id === variables.id ? {...view, starred: variables.starred} : view
          );
        }
      );
    },
    onError: (_error, variables) => {
      setApiQueryData<GroupSearchView[]>(
        queryClient,
        makeFetchGroupSearchViewsKey({orgSlug: organization.slug}),
        data => {
          return data?.map(view =>
            view.id === variables.id ? {...view, starred: !variables.starred} : view
          );
        }
      );
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
          <TableHeading>{t('My Views')}</TableHeading>
          <IssueViewSection
            createdBy={GroupSearchViewCreatedBy.ME}
            limit={10}
            cursorQueryParam="mc"
          />
          <TableHeading>{t('Created by Others')}</TableHeading>
          <IssueViewSection
            createdBy={GroupSearchViewCreatedBy.OTHERS}
            limit={10}
            cursorQueryParam="sc"
          />
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

const TableHeading = styled('h2')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-top: ${space(3)};
  margin-bottom: ${space(1.5)};
`;
