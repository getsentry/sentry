import {Fragment, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {RepositoryRow} from 'sentry/components/repositoryRow';
import {IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import RepositoryStore from 'sentry/stores/repositoryStore';
import type {Integration, Repository} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {IntegrationReposAddRepository} from './integrationReposAddRepository';

type DetectedPlatform = {
  bytes: number;
  confidence: string;
  language: string;
  platform: string;
};

type DetectionState = {
  error: string | null;
  loading: boolean;
  results: DetectedPlatform[] | null;
};

function RepoWithPlatformDetection({
  repo,
  orgSlug,
  isGitHub,
  onRepositoryChange,
}: {
  isGitHub: boolean;
  onRepositoryChange: (data: Repository) => void;
  orgSlug: string;
  repo: Repository;
}) {
  const api = useApi();
  const [state, setState] = useState<DetectionState>({
    loading: false,
    results: null,
    error: null,
  });

  async function handleDetect() {
    setState({loading: true, results: null, error: null});
    try {
      const response = await api.requestPromise(
        `/organizations/${orgSlug}/repos/${repo.id}/platforms/`
      );
      setState({loading: false, results: response.platforms, error: null});
    } catch (err) {
      const message =
        err?.responseJSON?.detail || err?.message || 'Failed to detect platforms';
      setState({loading: false, results: null, error: message});
    }
  }

  return (
    <div>
      <Flex align="center">
        <Flex flex={1}>
          <RepositoryRow
            repository={repo}
            orgSlug={orgSlug}
            onRepositoryChange={onRepositoryChange}
          />
        </Flex>
        {isGitHub && (
          <Flex padding="0 lg" flexShrink={0}>
            <Button size="sm" onClick={handleDetect} disabled={state.loading}>
              {state.loading ? t('Detecting...') : t('Detect Platforms')}
            </Button>
          </Flex>
        )}
      </Flex>
      {state.loading && (
        <Flex padding="sm lg">
          <LoadingIndicator mini />
        </Flex>
      )}
      {state.error && (
        <Flex padding="sm lg">
          <Text variant="danger" size="sm">
            {state.error}
          </Text>
        </Flex>
      )}
      {state.results?.length === 0 && (
        <Flex padding="sm lg">
          <Text variant="muted" size="sm">
            {t('No platforms detected for this repository.')}
          </Text>
        </Flex>
      )}
      {state.results && state.results.length > 0 && (
        <div style={{padding: '8px 16px 16px'}}>
          <table style={{width: '100%', fontSize: '13px', borderCollapse: 'collapse'}}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  borderBottom: '1px solid #e2dee6',
                  color: '#80708f',
                }}
              >
                <th style={{padding: '4px 8px'}}>{t('Platform')}</th>
                <th style={{padding: '4px 8px'}}>{t('Language')}</th>
                <th style={{padding: '4px 8px'}}>{t('Bytes')}</th>
                <th style={{padding: '4px 8px'}}>{t('Confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {state.results.map(p => (
                <tr key={p.platform} style={{borderBottom: '1px solid #f0ecf5'}}>
                  <td style={{padding: '4px 8px', fontWeight: 600}}>{p.platform}</td>
                  <td style={{padding: '4px 8px'}}>{p.language}</td>
                  <td style={{padding: '4px 8px'}}>{p.bytes.toLocaleString()}</td>
                  <td style={{padding: '4px 8px'}}>{p.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type Props = {
  integration: Integration;
};

export function IntegrationRepos(props: Props) {
  const [integrationReposErrorStatus, setIntegrationReposeErrorStatus] = useState<
    number | null | undefined
  >(null);

  const {integration} = props;
  const organization = useOrganization();
  const location = useLocation();
  const ENDPOINT = getApiUrl('/organizations/$organizationIdOrSlug/repos/', {
    path: {organizationIdOrSlug: organization.slug},
  });

  const {
    data: fetchedItemList,
    isPending,
    isError,
    refetch,
    getResponseHeader,
  } = useApiQuery<Repository[]>(
    [
      ENDPOINT,
      {
        query: {
          status: 'active',
          integration_id: integration.id,
          cursor: location.query.cursor,
        },
      },
    ],
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
          <Alert variant="danger">
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
              action={
                <LinkButton href="https://docs.sentry.io/product/releases/" external>
                  {t('Learn More')}
                </LinkButton>
              }
            >
              {t(
                'Add a repository to begin tracking its commit data. Then, set up release tracking to unlock features like suspect commits, suggested issue owners, and deploy emails.'
              )}
            </EmptyMessage>
          )}
          {itemList.map(repo => (
            <RepoWithPlatformDetection
              key={repo.id}
              repo={repo}
              orgSlug={organization.slug}
              isGitHub={integration.provider.key === 'github'}
              onRepositoryChange={onRepositoryChange}
            />
          ))}
        </PanelBody>
      </Panel>
      <Pagination pageLinks={itemListPageLinks} />
    </Fragment>
  );
}
