import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import SetupMessagingIntegrationButton from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

jest.mock('sentry/actionCreators/modal');

describe('SetupAlertIntegrationButton', function () {
  const organization = OrganizationFixture({
    features: ['messaging-integration-onboarding'],
  });
  const project = ProjectFixture();

  const getComponent = () => (
    <SetupMessagingIntegrationButton
      projectSlug={project.slug}
      refetchConfigs={jest.fn()}
    />
  );

  it('renders when no integration is installed', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: false,
      },
    });
    render(getComponent(), {organization: organization});
    await screen.findByRole('button', {name: /connect to messaging/i});
  });

  it('does not render button if alert integration installed when feature flag is on', function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: true,
      },
    });
    render(getComponent(), {organization: organization});
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens modal when clicked', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: false,
      },
    });
    render(getComponent(), {organization: organization});
    const button = await screen.findByRole('button', {name: /connect to messaging/i});
    await userEvent.click(button);
    expect(openModal).toHaveBeenCalled();
  });
});
