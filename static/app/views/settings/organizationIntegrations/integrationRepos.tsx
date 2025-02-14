import {Fragment, useState} from 'react';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import RepositoryRow from 'sentry/components/repositoryRow';
import {IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import RepositoryStore from 'sentry/stores/repositoryStore';
import type {Integration, Repository} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {IntegrationReposAddRepository} from './integrationReposAddRepository';

type Props = {
  integration: Integration;
};

function IntegrationRepos(props: Props) {
  const [integrationReposErrorStatus, setIntegrationReposeErrorStatus] = useState<
    number | null | undefined
  >(null);

  const {integration} = props;
  const organization = useOrganization();
  const ENDPOINT = `/organizations/${organization.slug}/repos/`;

  const {
    data: fetchedItemList,
    isPending,
    isError,
    refetch,
    getResponseHeader,
  } = useApiQuery<Repository[]>(
    [ENDPOINT, {query: {status: 'active', integration_id: integration.id}}],
    {
      staleTime: 0,
    }
  );
  const [itemListState, setItemList] = useState<Repository[]>([]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const itemList = itemListState.length ? itemListState : fetchedItemList;

  // Called by row to signal repository change.
  const onRepositoryChange = (data: Repository) => {
    const newItemList = itemList.map(item => {
      if (item.id === data.id) {
        item.status = data.status;
        // allow for custom scm repositories to be updated, and
        // url is optional and therefore can be an empty string
        item.url = data.url === undefined ? item.url : data.url;
        item.name = data.name || item.name;
      }
      return item;
    });
    setItemList(newItemList);
    RepositoryStore.resetRepositories();
  };

  const handleAddRepository = (repo: Repository) => {
    setItemList([...itemList, repo]);
  };

  const itemListPageLinks = getResponseHeader?.('Link') ?? undefined;

  return (
    <Fragment>
      {integrationReposErrorStatus === 400 && (
        <Alert.Container>
          <Alert type="error" showIcon>
            {t(
              'We were unable to fetch repositories for this integration. Try again later. If this error continues, please reconnect this integration by uninstalling and then reinstalling.'
            )}
          </Alert>
        </Alert.Container>
      )}

      <Panel>
        <PanelHeader hasButtons>
          <div>{t('Repositories')}</div>
          <IntegrationReposAddRepository
            integration={integration}
            currentRepositories={itemList}
            onSearchError={setIntegrationReposeErrorStatus}
            onAddRepository={handleAddRepository}
          />
        </PanelHeader>
        <PanelBody>
          {itemList.length === 0 && (
            <EmptyMessage
              icon={<IconCommit />}
              title={t('Sentry is better with commit data')}
              description={t(
                'Add a repository to begin tracking its commit data. Then, set up release tracking to unlock features like suspect commits, suggested issue owners, and deploy emails.'
              )}
              action={
                <LinkButton href="https://docs.sentry.io/product/releases/" external>
                  {t('Learn More')}
                </LinkButton>
              }
            />
          )}
          {itemList.map(repo => (
            <RepositoryRow
              key={repo.id}
              repository={repo}
              orgSlug={organization.slug}
              onRepositoryChange={onRepositoryChange}
            />
          ))}
        </PanelBody>
      </Panel>
      <Pagination pageLinks={itemListPageLinks} />
    </Fragment>
  );
}

export default IntegrationRepos;
