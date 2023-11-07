import {Fragment, useEffect, useState} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Repository} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import OrganizationRepositories from './organizationRepositories';

function OrganizationRepositoriesContainer() {
  const organization = useOrganization();
  const location = useLocation();

  const {
    data: itemData,
    isLoading,
    getResponseHeader,
  } = useApiQuery<Repository[]>(
    [`/organizations/${organization.slug}/repos/`, {query: location.query}],
    {staleTime: 0}
  );
  const itemListPageLinks = getResponseHeader?.('Link');
  const [itemList, setItemList] = useState<Repository[] | null>(null);

  useEffect(() => {
    setItemList(null);
  }, [location.query]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (itemData && !itemList) {
    setItemList(itemData);
  }

  // Callback used by child component to signal state change
  function onRepositoryChange(data: Pick<Repository, 'id' | 'status'>) {
    if (itemList) {
      setItemList(
        itemList.map(item =>
          item.id === data.id ? {...item, status: data.status} : item
        )
      );
    }
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
