import {Fragment, useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {ScmProviderPills} from 'sentry/components/onboarding/scm/scmProviderPills';
import {
  PipelineModal,
  type OpenPipelineModalOptions,
} from 'sentry/components/pipeline/modal';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {useOrganization} from 'sentry/utils/useOrganization';
import {organizationConfigIntegrationsQueryOptions} from 'sentry/views/settings/organizationRepositories/hooks/organizationConfigIntegrationsQueryOptions';

const SEER_SCM_PROVIDERS = new Set(['github', 'github_enterprise', 'gitlab']);

interface ConnectScmModalProps extends ModalRenderProps {
  onInstall: (integration: Integration) => void;
  repoName: string;
}

export function ConnectScmModal({
  repoName,
  onInstall,
  ...modalProps
}: ConnectScmModalProps) {
  const {Header, Body, closeModal} = modalProps;
  const organization = useOrganization();
  const {data, isPending, isLoadingError} = useQuery(
    organizationConfigIntegrationsQueryOptions({organization})
  );
  const providers = (data?.providers ?? []).filter(provider =>
    SEER_SCM_PROVIDERS.has(provider.key)
  );
  const [installPipeline, setInstallPipeline] =
    useState<OpenPipelineModalOptions<'integration'>>();

  useEffect(() => () => installPipeline?.onClose?.(), [installPipeline]);

  function handleInstall(integration: Integration) {
    onInstall(integration);
    closeModal();
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
