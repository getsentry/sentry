import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useApiQueries} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import AddIntegrationRow from 'sentry/views/alerts/rules/issue/addIntegrationRow';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

type Props = ModalRenderProps & {
  headerContent: React.ReactNode;
  project: Project;
  providerKeys: string[];
  bodyContent?: React.ReactNode;
  onAddIntegration?: () => void;
};

function MessagingIntegrationModal({
  closeModal,
  Header,
  Body,
  headerContent,
  bodyContent,
  providerKeys,
  project,
  onAddIntegration,
}: Props) {
  const organization = useOrganization();
  const queryResults = useApiQueries<{providers: IntegrationProvider[]}>(
    providerKeys.map((providerKey: string) => [
      `/organizations/${organization.slug}/config/integrations/?provider_key=${providerKey}`,
    ]),
    {staleTime: Infinity}
  );

  if (queryResults.some(({isPending}) => isPending)) {
    return null;
  }

  if (queryResults.some(({isError}) => isError)) {
    closeModal();
    addErrorMessage(t('Failed to load integration data'));
    return null;
  }

  return (
    <Fragment>
      <Header closeButton>
        <h1>{headerContent}</h1>
      </Header>
      <Body>
        <p>{bodyContent}</p>
        <IntegrationsWrapper>
          {queryResults.map(result => {
            const provider = result.data?.providers[0];

            if (!provider) {
              return null;
            }
            return (
              <IntegrationContext.Provider
                key={provider.key}
                value={{
                  provider: provider,
                  type: 'first_party',
                  installStatus: 'Not Installed',
                  analyticsParams: {
                    already_installed: false,
                    view: 'messaging_integration_onboarding',
                  },
                  onAddIntegration: onAddIntegration,
                  modalParams: {projectId: project.id},
                }}
              >
                <AddIntegrationRow onClick={closeModal} />
              </IntegrationContext.Provider>
            );
          })}
        </IntegrationsWrapper>
      </Body>
    </Fragment>
  );
}

const IntegrationsWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

export default MessagingIntegrationModal;
