import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import SetupAlertIntegrationButton from 'app/views/alerts/issueRuleEditor/setupAlertIntegrationButton';

describe('SetupAlertIntegrationButton', function () {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  it('renders button if no alert integrations', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/has-alert-integration-installed/`,
      body: {
        hasAlertIntegrationInstalled: false,
      },
    });
    const {container} = mountWithTheme(
      <SetupAlertIntegrationButton project={project} organization={organization} />
    );
    await tick();
    expect(container).toHaveTextContent('Set Up Slack Now');
  });
  it('does not renders button if alert integration installed', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/has-alert-integration-installed/`,
      body: {
        hasAlertIntegrationInstalled: true,
      },
    });
    const {container} = mountWithTheme(
      <SetupAlertIntegrationButton project={project} organization={organization} />
    );
    await tick();
    expect(container).not.toHaveTextContent('Set Up Slack Now');
  });
});
