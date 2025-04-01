import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import Redirect from 'sentry/components/redirect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {IssueViewsTable} from 'sentry/views/issueList/issueViews/issueViewsList/issueViewsTable';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {GroupSearchViewVisibility} from 'sentry/views/issueList/types';

type IssueViewSectionProps = {
  cursorQueryParam: string;
  limit: number;
  visibility: GroupSearchViewVisibility;
};

function IssueViewSection({visibility, limit, cursorQueryParam}: IssueViewSectionProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
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
    visibility,
    limit,
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
          <TableHeading>{t('Owned by Me')}</TableHeading>
          <IssueViewSection
            visibility={GroupSearchViewVisibility.OWNER}
            limit={10}
            cursorQueryParam="mc"
          />
          <TableHeading>{t('Shared with Me')}</TableHeading>
          <IssueViewSection
            visibility={GroupSearchViewVisibility.ORGANIZATION}
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
