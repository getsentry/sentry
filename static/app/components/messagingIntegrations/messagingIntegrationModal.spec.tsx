import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {MessagingIntegrationModal} from 'sentry/components/messagingIntegrations/messagingIntegrationModal';
import {MessagingIntegrationAnalyticsView} from 'sentry/components/messagingIntegrations/setupMessagingIntegrationButton';

jest.mock('sentry/actionCreators/modal');

describe('MessagingIntegrationModal', () => {
  const organization = OrganizationFixture();
  const providers = [
    GitHubIntegrationProviderFixture({key: 'slack', name: 'Slack'}),
    GitHubIntegrationProviderFixture({key: 'discord', name: 'Discord'}),
    GitHubIntegrationProviderFixture({key: 'msteams', name: 'Microsoft Teams'}),
  ];

  const getComponent = (closeModal = jest.fn(), props = {}) => (
    <MessagingIntegrationModal
      closeModal={closeModal}
      Header={makeClosableHeader(() => {})}
      Body={ModalBody}
      headerContent="Connect with a messaging tool"
      bodyContent="Receive alerts and digests right where you work."
      providers={providers}
      CloseButton={makeCloseButton(() => {})}
      Footer={ModalFooter}
      analyticsView={MessagingIntegrationAnalyticsView.PROJECT_CREATION}
      {...props}
    />
  );

  it('renders', async () => {
    render(getComponent(), {organization});

    const heading = await screen.findByRole('heading', {
      name: /connect with a messaging tool/i,
    });
    expect(heading).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Add Slack'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Discord'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Microsoft Teams'})).toBeInTheDocument();
  });
});
