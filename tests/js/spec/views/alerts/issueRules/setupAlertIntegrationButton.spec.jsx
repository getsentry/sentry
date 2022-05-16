import {render} from 'sentry-test/reactTestingLibrary';

import SetupAlertIntegrationButton from 'sentry/views/alerts/rules/issue/setupAlertIntegrationButton';

describe('SetupAlertIntegrationButton', function () {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  it('renders button if no alert integrations', function () {
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
  it('does not renders button if alert integration installed', function () {
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
});
