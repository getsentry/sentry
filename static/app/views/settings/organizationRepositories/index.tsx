import {Fragment} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import OrganizationRepositories from './organizationRepositories';

function OrganizationRepositoriesContainer() {
  const organization = useOrganization();
  const location = useLocation();
  const queryClient = useQueryClient();

  const {
    data: itemList,
    isLoading,
    isError,
    getResponseHeader,
  } = useApiQuery<Repository[]>(
    [`/organizations/${organization.slug}/repos/`, {query: location.query}],
    {staleTime: 0}
  );
  const itemListPageLinks = getResponseHeader?.('Link');

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  // Callback used by child component to signal state change
  function onRepositoryChange(data: Pick<Repository, 'id' | 'status'>) {
    setApiQueryData<Repository[]>(
      queryClient,
      [`/organizations/${organization.slug}/repos/`, {query: location.query}],
      oldItemList =>
        oldItemList.map(item =>
          item.id === data.id ? {...item, status: data.status} : item
        )
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle
        title={routeTitleGen(t('Repositories'), organization.slug, false)}
      />
      <OrganizationRepositories
        organization={organization}
        itemList={itemList!}
        onRepositoryChange={onRepositoryChange}
      />
      {itemListPageLinks && <Pagination pageLinks={itemListPageLinks} />}
    </Fragment>
  );
}

export default OrganizationRepositoriesContainer;
