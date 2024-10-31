import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider} from 'sentry/types/integrations';
import AddIntegrationRow from 'sentry/views/alerts/rules/issue/addIntegrationRow';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

type Props = ModalRenderProps & {
  headerContent: React.ReactNode;
  providers: IntegrationProvider[];
  bodyContent?: React.ReactNode;
  modalParams?: {[key: string]: string};
  onAddIntegration?: () => void;
};

function MessagingIntegrationModal({
  closeModal,
  Header,
  Body,
  headerContent,
  bodyContent,
  providers,
  modalParams,
  onAddIntegration,
}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h1>{headerContent}</h1>
      </Header>
      <Body>
        <p>{bodyContent}</p>
        <IntegrationsWrapper>
          {providers.map(provider => {
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
                  ...(modalParams && {modalParams}),
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
