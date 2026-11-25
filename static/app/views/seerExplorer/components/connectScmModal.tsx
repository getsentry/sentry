import {Fragment, useEffect, useState, type ReactNode} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {openModal, type ModalRenderProps} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ScmProviderPills} from 'sentry/components/onboarding/scm/scmProviderPills';
import {
  PipelineModal,
  type OpenPipelineModalOptions,
} from 'sentry/components/pipeline/modal';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {canManageIntegrations} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTimeout} from 'sentry/utils/useTimeout';
import {organizationConfigIntegrationsQueryOptions} from 'sentry/views/settings/organizationRepositories/hooks/organizationConfigIntegrationsQueryOptions';

const SEER_SCM_PROVIDERS = new Set(['github', 'github_enterprise', 'gitlab']);

const CONNECT_SCM_REPO_PARAM = 'connectScmRepo';

const SYNC_POLL_INTERVAL_MS = 2_000;
const SYNC_WAIT_MS = 10 * 60_000;

export interface RepoAccess {
  connectedAccounts: string[];
  /**
   * `found` when Seer can open the repo, `unknown` when Sentry can't say why it can't, or the
   * reason it can't.
   */
  status: string;
}

/**
 * Whether Seer can open the repo now. Seer never pauses for a name that matches more than one
 * repo (it tells the agent instead), so this counts that as found.
 */
// TODO(joey): Handle `repo_ambiguous` properly, e.g. by saying the name matches more than one
// repo and asking the user which one, instead of counting it as found.
export function isFound(status: string) {
  return status === 'found' || status === 'repo_ambiguous';
}

interface RepoSync {
  status: 'syncing' | 'done' | 'failed' | null;
}

interface ConnectScmModalProps extends ModalRenderProps {
  onInstall: (integration: Integration) => void;
  repoName: string;
}

export function openConnectScmModal({
  repoName,
  onInstall,
}: Pick<ConnectScmModalProps, 'repoName' | 'onInstall'>) {
  openModal(
    modalProps => (
      <ConnectScmModal {...modalProps} repoName={repoName} onInstall={onInstall} />
    ),
    {closeEvents: 'escape-key'}
  );
}

export function useConnectScmModalFromUrl() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [repoName, setRepoName] = useQueryState(
    CONNECT_SCM_REPO_PARAM,
    parseAsString.withOptions({history: 'replace'})
  );
  const canInstall = canManageIntegrations(organization);
  const hasPrompt = organization.features.includes('ask-seer-scm-connect-prompt');

  useEffect(() => {
    if (repoName === null) {
      return;
    }
    setRepoName(null);
    const name = repoName.trim();
    if (!name || !canInstall || !hasPrompt) {
      return;
    }
    openConnectScmModal({
      repoName: name,
      onInstall: () =>
        queryClient.invalidateQueries(
          apiOptions.queryFilter('/organizations/$organizationIdOrSlug/integrations/', {
            path: {organizationIdOrSlug: organization.slug},
          })
        ),
    });
  }, [repoName, setRepoName, canInstall, hasPrompt, queryClient, organization.slug]);
}

function ConnectScmModal({repoName, onInstall, ...modalProps}: ConnectScmModalProps) {
  const {Header, Body} = modalProps;
  const organization = useOrganization();
  const {data, isPending, isLoadingError} = useQuery(
    organizationConfigIntegrationsQueryOptions({organization})
  );
  const providers = (data?.providers ?? []).filter(provider =>
    SEER_SCM_PROVIDERS.has(provider.key)
  );
  const [installPipeline, setInstallPipeline] =
    useState<OpenPipelineModalOptions<'integration'>>();
  const [installed, setInstalled] = useState<Integration>();

  useEffect(() => () => installPipeline?.onClose?.(), [installPipeline]);

  function handleInstall(integration: Integration) {
    onInstall(integration);
    setInstalled(integration);
  }

  if (installed) {
    return <ReposStep {...modalProps} integration={installed} repoName={repoName} />;
  }

  if (installPipeline) {
    return (
      <PipelineModal
        {...modalProps}
        type={installPipeline.type}
        provider={installPipeline.provider}
        initialData={installPipeline.initialData}
        title={installPipeline.title}
        description={installPipeline.description}
        onComplete={installPipeline.onComplete}
        onError={installPipeline.onError}
        onBack={() => setInstallPipeline(undefined)}
        closeModal={() => setInstallPipeline(undefined)}
      />
    );
  }

  return (
    <Fragment>
      <Header closeButton>
        <Text size="lg">{t('Connect source control')}</Text>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text>
            {tct(
              'Seer needs access to [repoName]. Connect the source control account it belongs to.',
              {repoName: <Text bold>{repoName}</Text>}
            )}
          </Text>
          {isPending ? (
            <Placeholder height="36px" width="240px" />
          ) : isLoadingError ? (
            <Alert variant="danger">
              {t("Couldn't load the source control providers. Try again in a moment.")}
            </Alert>
          ) : (
            <ScmProviderPills
              analyticsFlow="seer-explorer"
              providers={providers}
              onInstall={handleInstall}
              openInstallPipeline={setInstallPipeline}
            />
          )}
        </Stack>
      </Body>
    </Fragment>
  );
}

interface ReposStepProps extends ModalRenderProps {
  integration: Pick<Integration, 'id' | 'name'> & {
    provider: Pick<Integration['provider'], 'name'>;
  };
  repoName: string;
}

function ReposStep({integration, repoName, Header, Body, closeModal}: ReposStepProps) {
  const organization = useOrganization();
  const provider = integration.provider.name;
  const [isWaiting, setIsWaiting] = useState(true);
  const {start: startWaiting} = useTimeout({
    timeMs: SYNC_WAIT_MS,
    onTimeout: () => setIsWaiting(false),
  });
  useEffect(() => {
    startWaiting();
  }, [startWaiting]);

  const {
    data: sync,
    isError: isSyncError,
    refetch: refetchSync,
  } = useQuery({
    ...apiOptions.as<RepoSync>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/repo-sync/',
      {
        path: {organizationIdOrSlug: organization.slug, integrationId: integration.id},
        staleTime: 0,
      }
    ),
    refetchIntervalInBackground: true,
    refetchInterval: query =>
      isWaiting && query.state.data?.json.status === 'syncing'
        ? SYNC_POLL_INTERVAL_MS
        : false,
  });

  const isSyncDone = sync?.status === 'done';
  const repoAccessOptions = apiOptions.as<RepoAccess>()(
    '/organizations/$organizationIdOrSlug/seer/repo-access/',
    {path: {organizationIdOrSlug: organization.slug}, query: {repoName}, staleTime: 0}
  );
  const repoAccessKey: ApiQueryKey = repoAccessOptions.queryKey;
  const {
    data: access,
    isError: isAccessError,
    refetch: refetchAccess,
  } = useQuery({
    ...repoAccessOptions,
    queryKey: [...repoAccessKey, {integrationId: integration.id}] as const,
    enabled: isSyncDone,
    retry: false,
  });

  const canAccess = !!access && isFound(access.status);
  const shouldClose = sync?.status === null || canAccess;
  useEffect(() => {
    if (shouldClose) {
      closeModal();
    }
  }, [shouldClose, closeModal]);

  function checkAgain() {
    setIsWaiting(true);
    startWaiting();
    refetchSync();
    refetchAccess();
  }

  const hasFailed =
    isSyncError ||
    isAccessError ||
    sync?.status === 'failed' ||
    (sync?.status === 'syncing' && !isWaiting);
  const isLoading = !hasFailed && (!isSyncDone || !access);
  const repo = <Text bold>{repoName}</Text>;

  let message: ReactNode;
  if (shouldClose || isLoading) {
    message = (
      <LoadingIndicator>
        {t('Getting your repos from %s. This usually takes a few seconds.', provider)}
      </LoadingIndicator>
    );
  } else if (hasFailed) {
    message = (
      <LoadingError
        message={t("Couldn't get your repos from %s. Try again later.", provider)}
        onRetry={checkAgain}
      />
    );
  } else {
    message = (
      <Alert
        variant="warning"
        trailingItems={
          <Alert.Button onClick={checkAgain}>{t('Check again')}</Alert.Button>
        }
      >
        {tct(
          "[repo] isn't in the repos Sentry got from [account]. On [provider], check that Sentry has access to it, then check again.",
          {repo, account: integration.name, provider}
        )}
      </Alert>
    );
  }

  return (
    <Fragment>
      <Header closeButton>
        <Text size="lg">{t('Connect source control')}</Text>
      </Header>
      <Body>
        <Stack gap="lg">
          <Text>
            {tct('[provider] connected: [account]', {
              provider,
              account: <Text bold>{integration.name}</Text>,
            })}
          </Text>
          {message}
        </Stack>
      </Body>
    </Fragment>
  );
}
