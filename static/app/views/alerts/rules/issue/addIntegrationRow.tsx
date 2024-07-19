import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

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
};

function AddIntegrationRow({integrationSlug, organization, project, closeModal}: Props) {
  const [hasError, setHasError] = useState(false);
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
        setHasError(false);
      })
      .catch(error => {
        setHasError(true);
        throw error;
      });
  }, [integrationSlug, api, organization.slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!provider || hasError) {
    return null;
  }

  return (
    <RowWrapper>
      <IconTextWrapper>
        <PluginIcon pluginId={integrationSlug} size={40} />
        <NameHeader>Connect {provider.name}</NameHeader>
      </IconTextWrapper>
      <AddIntegrationButton
        provider={provider}
        onAddIntegration={() => closeModal}
        organization={organization}
        priority="primary"
        size="sm"
        analyticsParams={{view: 'onboarding', already_installed: false}}
        modalParams={{projectId: project.id}}
      />
    </RowWrapper>
  );
}

const RowWrapper = styled('div')`
  display: flex;
  border-radius: 4px;
  border: 1px solid ${p => p.theme.gray200};
  justify-content: space-between;
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
