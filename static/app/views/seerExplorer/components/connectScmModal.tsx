import {Fragment, useEffect, useId, useState, type ReactNode} from 'react';
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
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {canManageIntegrations} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTimeout} from 'sentry/utils/useTimeout';
import {organizationConfigIntegrationsQueryOptions} from 'sentry/views/settings/organizationRepositories/hooks/organizationConfigIntegrationsQueryOptions';

import {
  REPO_ACCESS_POLL_INTERVAL_MS,
  REPO_ACCESS_WAIT_MS,
  repoAccessInstallScope,
  repoAccessQueryOptions,
} from './repoAccessQuery';

const SEER_SCM_PROVIDERS = new Set(['github', 'github_enterprise', 'gitlab']);

const CONNECT_SCM_REPO_PARAM = 'connectScmRepo';

interface ConnectScmModalProps extends ModalRenderProps {
  /** Null when there's no repo: Seer's list of repos came back empty. */
  repoName: string | null;
  /** The chat's paused input. Not set when a link opened the modal. */
  inputId?: string;
  onInstall?: () => void;
}

export function openConnectScmModal({
  repoName,
  onInstall,
  inputId,
}: Pick<ConnectScmModalProps, 'repoName' | 'onInstall' | 'inputId'>) {
  openModal(
    modalProps => (
      <ConnectScmModal
        {...modalProps}
        repoName={repoName}
        onInstall={onInstall}
        inputId={inputId}
      />
    ),
    {closeEvents: 'escape-key'}
  );
}

export function useConnectScmModalFromUrl() {
  const organization = useOrganization();
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
    if (!canInstall || !hasPrompt) {
      return;
    }
    openConnectScmModal({repoName: repoName.trim() || null});
  }, [repoName, setRepoName, canInstall, hasPrompt]);
}

function ConnectScmModal({
  repoName,
  onInstall,
  inputId,
  ...modalProps
}: ConnectScmModalProps) {
  const {Header, Body} = modalProps;
  const organization = useOrganization();
  const queryClient = useQueryClient();
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
    if (inputId) {
      queryClient.setQueryData(
        repoAccessInstallScope(organization.slug, inputId).queryKey,
        integration.id
      );
    }
    onInstall?.();
    setInstalled(integration);

    // Refresh views behind the modal, independently of checking whether Seer can continue.
    void queryClient.invalidateQueries({
      ...apiOptions.queryFilter('/organizations/$organizationIdOrSlug/integrations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      predicate: ({queryKey}) => {
        const query = safeParseQueryKey(queryKey)?.options.query;
        return (
          (!query?.providerKey || query.providerKey === integration.provider.key) &&
          (!query?.integrationType || query.integrationType === 'source_code_management')
        );
      },
    });
  }

  if (installed) {
    return (
      <ReposStep
        {...modalProps}
        integration={installed}
        repoName={repoName}
        inputId={inputId}
      />
    );
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
            {repoName
              ? tct(
                  'Seer needs access to [repoName]. Connect the source control account it belongs to.',
                  {repoName: <Text bold>{repoName}</Text>}
                )
              : t(
                  "Seer can't see this organization's repos. Connect the source control account they're on."
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
  repoName: string | null;
  inputId?: string;
}

function ReposStep({
  integration,
  repoName,
  inputId,
  Header,
  Body,
  closeModal,
}: ReposStepProps) {
  const organization = useOrganization();
  const standaloneCheckId = useId();
  const provider = integration.provider.name;
  const [timedOut, setTimedOut] = useState(false);
  const {start: startWaiting} = useTimeout({
    timeMs: REPO_ACCESS_WAIT_MS,
    onTimeout: () => setTimedOut(true),
  });
  useEffect(() => {
    startWaiting();
  }, [startWaiting]);

  const {
    data: access,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    ...repoAccessQueryOptions({
      orgSlug: organization.slug,
      repoName,
      integrationId: integration.id,
      checkId: inputId ?? standaloneCheckId,
    }),
    // In chat the popup starts and polls this query. The modal just reads its result.
    enabled: !inputId,
    refetchIntervalInBackground: true,
    refetchInterval: query =>
      !timedOut && query.state.data?.json.status === 'repos_syncing'
        ? REPO_ACCESS_POLL_INTERVAL_MS
        : false,
  });

  const canAccess = access?.status === 'found';
  useEffect(() => {
    if (canAccess) {
      closeModal();
    }
  }, [canAccess, closeModal]);

  const checkAgain = () => refetch({cancelRefetch: false});
  const repo = <Text bold>{repoName}</Text>;

  let message: ReactNode;
  if (canAccess || (!isError && !access) || (isFetching && !access)) {
    message = <LoadingIndicator>{t('Checking repository access…')}</LoadingIndicator>;
  } else if (isError) {
    message = (
      <LoadingError
        message={t("Couldn't check repository access.")}
        onRetry={checkAgain}
      />
    );
  } else if (access?.status === 'repos_syncing' && !timedOut) {
    message = (
      <LoadingIndicator>
        {t('Getting your repos from %s. This usually takes a few seconds.', provider)}
      </LoadingIndicator>
    );
  } else if (access?.syncFailure || access?.status === 'repos_syncing') {
    message = (
      <LoadingError
        message={
          access.syncFailure
            ? t("Couldn't get your repos from %s. Try again later.", provider)
            : t('Still waiting for your repos from %s.', provider)
        }
        onRetry={checkAgain}
      />
    );
  } else {
    let detail: ReactNode;
    switch (access?.status) {
      case 'repo_ambiguous':
        detail = t('More than one repository matches this name.');
        break;
      case 'scm_account_not_connected':
        detail = t(
          "This repo's source control account isn't connected to this organization."
        );
        break;
      case 'repo_not_in_sentry':
        detail = tct(
          "[repo] isn't in Sentry. On [provider], check that Sentry has access to it, then check again.",
          {repo, provider}
        );
        break;
      default:
        detail = t("Seer still can't access the repositories for this organization.");
        break;
    }
    message = (
      <Alert
        variant="warning"
        trailingItems={
          <Alert.Button onClick={checkAgain}>{t('Check again')}</Alert.Button>
        }
      >
        {detail}
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
