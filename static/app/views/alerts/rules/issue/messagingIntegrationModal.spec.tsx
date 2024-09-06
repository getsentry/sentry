import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {t} from 'sentry/locale';
import MessagingIntegrationModal from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';

jest.mock('sentry/actionCreators/modal');

describe('MessagingIntegrationModal', function () {
  let project, org;
  const providerKeys = ['slack', 'discord', 'msteams'];
  const providers = (providerKey: string) => [
    GitHubIntegrationProviderFixture({key: providerKey}),
  ];

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    project = ProjectFixture();
    org = OrganizationFixture();

    jest.clearAllMocks();
  });

  const getComponent = (closeModal = jest.fn(), props = {}) => (
    <MessagingIntegrationModal
      closeModal={closeModal}
      Header={makeClosableHeader(() => {})}
      Body={ModalBody}
      headerContent={t('Connect with a messaging tool')}
      bodyContent={t('Receive alerts and digests right where you work.')}
      providerKeys={providerKeys}
      project={project}
      CloseButton={makeCloseButton(() => {})}
      Footer={ModalFooter}
      {...props}
    />
  );

  it('renders', async function () {
    const mockResponses: jest.Mock<any>[] = [];
    providerKeys.forEach(providerKey => {
      mockResponses.push(
        MockApiClient.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/?provider_key=${providerKey}`,
          body: {providers: providers(providerKey)},
        })
      );
    });
    render(getComponent(), {organization: org});

    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
    const heading = await screen.findByRole('heading', {
      name: /connect with a messaging tool/i,
    });
    expect(heading).toBeInTheDocument();
    const buttons = await screen.findAllByRole('button', {name: /add integration/i});
    expect(buttons).toHaveLength(providerKeys.length);
  });

  it('closes on error', async function () {
    const closeModal = jest.fn();
    jest.spyOn(indicators, 'addErrorMessage');

    const mockResponses: jest.Mock<any>[] = [];
    providerKeys.forEach(value => {
      mockResponses.push(
        MockApiClient.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/?provider_key=${value}`,
          statusCode: 400,
          body: {error: 'internal error'},
        })
      );
    });

    render(getComponent(closeModal), {organization: org});

    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(closeModal).toHaveBeenCalled();
      expect(indicators.addErrorMessage).toHaveBeenCalled();
    });
  });
});
