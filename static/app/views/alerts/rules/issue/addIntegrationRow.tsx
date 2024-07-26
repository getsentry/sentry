import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';

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

  const buttonProps = {
    size: 'sm' as const,
    priority: 'primary' as const,
    'data-test-id': 'install-button',
  };

  return (
    <RowWrapper>
      <IconTextWrapper>
        <PluginIcon pluginId={providerKey} size={40} />
        <NameHeader>Connect {provider.name}</NameHeader>
      </IconTextWrapper>
      <Access access={['org:integrations']} organization={organization}>
        {({hasAccess}) => {
          return (
            <StyledButton
              onAddIntegration={onClickHandler}
              onExternalClick={onClickHandler}
              organization={organization}
              provider={provider}
              type="first_party"
              userHasAccess={hasAccess}
              installStatus="Not Installed"
              analyticsParams={{
                view: 'onboarding',
                already_installed: false,
              }}
              externalInstallText="Add Installation"
              modalParams={{project: project.id}}
              buttonProps={buttonProps}
            />
          );
        }}
      </Access>
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

const StyledButton = styled(IntegrationButton)`
  margin: 0;
`;

export default AddIntegrationRow;
