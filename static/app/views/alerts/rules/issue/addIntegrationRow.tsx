import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

type Props = {
  onClickHandler: () => void;
  organization: Organization;
  project: Project;
  providerKey: string;
  setHasError: (boolean) => void;
};

function AddIntegrationRow({
  providerKey,
  organization,
  project,
  onClickHandler,
  setHasError,
}: Props) {
  const [provider, setProvider] = useState<IntegrationProvider | null>(null);

  const api = useApi();
  const fetchData = useCallback(() => {
    if (!providerKey) {
      return Promise.resolve();
    }

    const endpoint = `/organizations/${organization.slug}/config/integrations/?provider_key=${providerKey}`;
    return api
      .requestPromise(endpoint)
      .then(integrations => {
        setProvider(integrations.providers[0]);
      })
      .catch(() => {
        setHasError(true);
      });
  }, [providerKey, api, organization.slug, setHasError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!provider) {
    return null;
  }

  const {metadata} = provider;

  const buttonProps = {
    size: 'sm' as const,
    priority: 'primary' as const,
    'data-test-id': 'install-button',
    organization,
  };

  const close = () => onClickHandler;

  // TODO(Mia): show request installation button if user does not have necessary permissions
  const integrationButton = metadata.aspects.externalInstall ? (
    <ExternalButton
      href={metadata.aspects.externalInstall.url}
      onClick={() => close}
      external
      {...buttonProps}
    >
      Add Installation
    </ExternalButton>
  ) : (
    <InternalButton
      provider={provider}
      onAddIntegration={close}
      analyticsParams={{view: 'onboarding', already_installed: false}}
      modalParams={{projectId: project.id}}
      {...buttonProps}
    />
  );

  return (
    <RowWrapper>
      <IconTextWrapper>
        <PluginIcon pluginId={providerKey} size={40} />
        <NameHeader>Connect {provider.name}</NameHeader>
      </IconTextWrapper>
      {integrationButton}
    </RowWrapper>
  );
}

const RowWrapper = styled('div')`
  display: flex;
  border-radius: 4px;
  border: 1px solid ${p => p.theme.gray200};
  justify-content: space-between;
  align-items: center;
  padding: ${space(3)} ${space(4)};
`;

const IconTextWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(3)};
`;

const NameHeader = styled('h6')`
  margin: 0;
`;

const ExternalButton = styled(Button)`
  margin: 0;
`;

const InternalButton = styled(AddIntegrationButton)`
  margin: 0;
`;

export default AddIntegrationRow;
