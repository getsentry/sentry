import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider, Project} from 'sentry/types';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

type Props = {
  closeModal: () => void;
  integrationSlug: string;
  organization: Organization;
  project: Project;
  setHasError: (boolean) => void;
};

function AddIntegrationRow({
  integrationSlug,
  organization,
  project,
  closeModal,
  setHasError,
}: Props) {
  const [provider, setProvider] = useState<IntegrationProvider | null>(null);

  const api = useApi();
  const fetchData = useCallback(() => {
    if (!integrationSlug) {
      return Promise.resolve();
    }

    const endpoint = `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`;
    return api
      .requestPromise(endpoint)
      .then(integrations => {
        setProvider(integrations.providers[0]);
      })
      .catch(() => {
        setHasError(true);
      });
  }, [integrationSlug, api, organization.slug, setHasError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!provider) {
    return null;
  }

  const {metadata} = provider;
  const size = 'sm' as const;
  const priority = 'primary' as const;

  const buttonProps = {
    style: {margin: 0},
    size,
    priority,
    'data-test-id': 'install-button',
    organization,
  };

  // TODO(Mia): disable button if user does not have necessary permissions
  const integrationButton = metadata.aspects.externalInstall ? (
    <Button
      href={metadata.aspects.externalInstall.url}
      onClick={() => closeModal()}
      external
      {...buttonProps}
    >
      Add Installation
    </Button>
  ) : (
    <AddIntegrationButton
      provider={provider}
      onAddIntegration={() => closeModal}
      analyticsParams={{view: 'onboarding', already_installed: false}}
      modalParams={{projectId: project.id}}
      {...buttonProps}
    />
  );

  return (
    <RowWrapper>
      <IconTextWrapper>
        <PluginIcon pluginId={integrationSlug} size={40} />
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

export default AddIntegrationRow;
