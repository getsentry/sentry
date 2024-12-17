import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {t} from 'sentry/locale';
import MessagingIntegrationModal from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';
import {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

jest.mock('sentry/actionCreators/modal');

describe('MessagingIntegrationModal', function () {
  const organization = OrganizationFixture();
  const providerKeys = ['slack', 'discord', 'msteams'];
  const providers = providerKeys.map(providerKey =>
    GitHubIntegrationProviderFixture({key: providerKey})
  );

  const getComponent = (closeModal = jest.fn(), props = {}) => (
    <MessagingIntegrationModal
      closeModal={closeModal}
      Header={makeClosableHeader(() => {})}
      Body={ModalBody}
      headerContent={t('Connect with a messaging tool')}
      bodyContent={t('Receive alerts and digests right where you work.')}
      providers={providers}
      CloseButton={makeCloseButton(() => {})}
      Footer={ModalFooter}
      analyticsView={MessagingIntegrationAnalyticsView.PROJECT_CREATION}
      {...props}
    />
  );

  it('renders', async function () {
    render(getComponent(), {organization});

    const heading = await screen.findByRole('heading', {
      name: /connect with a messaging tool/i,
    });
    expect(heading).toBeInTheDocument();
    const buttons = await screen.findAllByRole('button', {name: /add integration/i});
    expect(buttons).toHaveLength(providerKeys.length);
  });
});
