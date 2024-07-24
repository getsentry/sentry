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
import MessagingIntegrationModal from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';

jest.mock('sentry/actionCreators/modal');

describe('MessagingIntegrationModal', function () {
  let project, org;
  const providerKeys = ['slack', 'discord', 'msteams'];
  const providers = [GitHubIntegrationProviderFixture()];

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    project = ProjectFixture();
    org = OrganizationFixture({
      features: ['messaging-integration-onboarding'],
    });

    jest.clearAllMocks();
  });

  const getComponent = (closeModal?, props = {}) => (
    <MessagingIntegrationModal
      Header={makeClosableHeader(() => {})}
      Body={ModalBody}
      headerContent={<h1>Connect with a messaging tool</h1>}
      bodyContent={<p>Receive alerts and digests right where you work.</p>}
      providerKeys={providerKeys}
      organization={org}
      project={project}
      CloseButton={makeCloseButton(() => {})}
      Footer={ModalFooter}
      closeModal={closeModal ? closeModal : jest.fn()}
      {...props}
    />
  );

  it('renders', async function () {
    const mockResponses: jest.Mock<any>[] = [];
    providerKeys.forEach(providerKey => {
      mockResponses.push(
        MockApiClient.addMockResponse({
          url: `/organizations/${org.slug}/config/integrations/?provider_key=${providerKey}`,
          body: {providers: providers},
        })
      );
    });
    render(getComponent());

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

    render(getComponent(closeModal));

    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(closeModal).toHaveBeenCalled();
      expect(indicators.addErrorMessage).toHaveBeenCalled();
    });
  });
});
