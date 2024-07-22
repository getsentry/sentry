import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import MessagingIntegrationModal from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';

jest.mock('sentry/actionCreators/modal');

describe('MessagingIntegrationModal', function () {
  let project, org, integrationSlug;
  const providers = [GitHubIntegrationProviderFixture()];

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    project = ProjectFixture();
    org = OrganizationFixture({
      features: ['messaging-integration-onboarding'],
    });

    integrationSlug = 'slack';

    jest.clearAllMocks();
  });

  const getComponent = (props = {}) => (
    <MessagingIntegrationModal
      Header={() => <div />}
      Body={ModalBody}
      organization={org}
      project={project}
      CloseButton={makeCloseButton(() => {})}
      Footer={ModalFooter}
      closeModal={jest.fn()}
      {...props}
    />
  );

  it('renders', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=slack`,
      body: {providers: {providers}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=discord`,
      body: {providers: {providers}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=msteams`,
      body: {providers: {providers}},
    });
    render(getComponent());
    screen.logTestingPlaygroundURL();

    await waitFor(() => {
      expect(screen.getByText('Connect with a messaging tool')).toBeInTheDocument();
    });
  });

  it('closes on error', async function () {
    const closeModal = jest.fn();

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=${integrationSlug}`,
      statusCode: 400,
      body: {error: 'internal error'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=discord`,
      body: {providers: {providers}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=msteams`,
      body: {providers: {providers}},
    });

    render(
      <MessagingIntegrationModal
        Header={() => <div />}
        Body={ModalBody}
        organization={org}
        project={project}
        CloseButton={makeCloseButton(() => {})}
        Footer={ModalFooter}
        closeModal={closeModal}
      />
    );

    await waitFor(() => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(closeModal).toHaveBeenCalled();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
