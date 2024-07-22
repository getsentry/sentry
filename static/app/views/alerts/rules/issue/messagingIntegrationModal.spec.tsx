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
  const integrationSlugs = ['slack', 'discord', 'msteams'];
  const providers = [GitHubIntegrationProviderFixture()];

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    project = ProjectFixture();
    org = OrganizationFixture({
      features: ['messaging-integration-onboarding'],
    });

    jest.clearAllMocks();
  });

  const getComponent = (props = {}) => (
    <MessagingIntegrationModal
      Header={makeClosableHeader(() => {})}
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
    integrationSlugs.forEach(value => {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/config/integrations/?provider_key=${value}`,
        body: {providers: providers},
      });
    });

    render(getComponent());

    await waitFor(() => {
      expect(screen.getByText('Connect with a messaging tool')).toBeInTheDocument();
      const buttons = screen.getAllByRole('button', {name: /add integration/i});
      expect(buttons).toHaveLength(3);
    });
  });

  it('closes on error', async function () {
    const closeModal = jest.fn();
    jest.spyOn(indicators, 'addErrorMessage');

    integrationSlugs.forEach(value => {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/config/integrations/?provider_key=${value}`,
        statusCode: 400,
        body: {error: 'internal error'},
      });
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
      expect(closeModal).toHaveBeenCalled();
      expect(indicators.addErrorMessage).toHaveBeenCalled();
    });
  });
});
