import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render} from 'sentry-test/reactTestingLibrary';

import SetupAlertIntegrationButton from 'sentry/views/alerts/rules/issue/setupAlertIntegrationButton';

jest.mock('sentry/actionCreators/modal');

describe('SetupAlertIntegrationButton', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  it('renders slack button if no alert integrations are installed', function () {
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
        refetchConfigs={jest.fn()}
      />
    );
    expect(container).toHaveTextContent('Set Up Slack Now');
  });
  it('does not render button if alert integration is installed', function () {
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
        refetchConfigs={jest.fn()}
      />
    );
    expect(container).not.toHaveTextContent('Set Up Slack Now');
  });
});
