import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {IntegrationProvider} from 'sentry/types/integrations';
import AddIntegrationRow from 'sentry/views/alerts/rules/issue/addIntegrationRow';
import type {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

type Props = ModalRenderProps & {
  analyticsView: MessagingIntegrationAnalyticsView;
  headerContent: React.ReactNode;
  providers: IntegrationProvider[];
  bodyContent?: React.ReactNode;
  modalParams?: Record<string, string>;
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
  analyticsView,
}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h1>{headerContent}</h1>
      </Header>
      <Body>
        <p>{bodyContent}</p>
        <Stack gap="xl">
          {providers.map(provider => {
            return (
              <IntegrationContext
                key={provider.key}
                value={{
                  provider,
                  type: 'first_party',
                  installStatus: 'Not Installed',
                  analyticsParams: {
                    already_installed: false,
                    view: analyticsView,
                  },
                  onAddIntegration,
                  ...(modalParams && {modalParams}),
                }}
              >
                <AddIntegrationRow onClick={closeModal} />
              </IntegrationContext>
            );
          })}
        </Stack>
      </Body>
    </Fragment>
  );
}

export default MessagingIntegrationModal;
