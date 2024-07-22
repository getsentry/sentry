import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import SetupAlertIntegrationButton from 'sentry/views/alerts/rules/issue/setupAlertIntegrationButton';

jest.mock('sentry/actionCreators/modal');

describe('SetupAlertIntegrationButton', function () {
  const organization = OrganizationFixture();
  const featureOrg = OrganizationFixture({
    features: ['messaging-integration-onboarding'],
  });
  const project = ProjectFixture();

  it('renders slack button if no alert integrations when feature flag is off', function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/?expand=hasAlertIntegration`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: false,
      },
    });
    const {container} = render(
      <SetupAlertIntegrationButton
        projectSlug={project.slug}
        organization={organization}
      />
    );
    expect(container).toHaveTextContent('Set Up Slack Now');
  });
  it('does not render button if alert integration installed when feature flag is off', function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/?expand=hasAlertIntegration`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: true,
      },
    });
    const {container} = render(
      <SetupAlertIntegrationButton
        projectSlug={project.slug}
        organization={organization}
      />
    );
    expect(container).not.toHaveTextContent('Set Up Slack Now');
  });
  it('renders connect to messaging button when feature flag is on', function () {
    MockApiClient.addMockResponse({
      url: `/projects/${featureOrg.slug}/${project.slug}/?expand=hasAlertIntegration`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: false,
      },
    });
    const {container} = render(
      <SetupAlertIntegrationButton projectSlug={project.slug} organization={featureOrg} />
    );
    expect(container).toHaveTextContent('Connect to messaging');
  });
  it('does not render button if alert integration installed when feature flag is on', function () {
    MockApiClient.addMockResponse({
      url: `/projects/${featureOrg.slug}/${project.slug}/?expand=hasAlertIntegration`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: true,
      },
    });
    const {container} = render(
      <SetupAlertIntegrationButton projectSlug={project.slug} organization={featureOrg} />
    );
    expect(container).not.toHaveTextContent('Connect to messaging');
  });
  it('opens modal when clicked', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${featureOrg.slug}/${project.slug}/?expand=hasAlertIntegration`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: false,
      },
    });
    render(
      <SetupAlertIntegrationButton projectSlug={project.slug} organization={featureOrg} />
    );
    await userEvent.click(screen.getByLabelText('Connect to messaging'));

    expect(openModal).toHaveBeenCalled();
  });
});
