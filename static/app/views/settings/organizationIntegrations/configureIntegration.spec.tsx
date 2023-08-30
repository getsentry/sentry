import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigureIntegration from 'sentry/views/settings/organizationIntegrations/configureIntegration';

describe('OpsgenieMigrationButton', function () {
  const org = TestStubs.Organization({
    access: ['org:integrations', 'org:write'],
  });
  const integrationId = '1';
  it('Migrate Plugin button hits migration endpoint', async function () {
    org.features.push('integrations-opsgenie-migration');
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/`,
      body: {
        providers: [TestStubs.OpsgenieIntegrationProvider()],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/`,
      body: TestStubs.OpsgenieIntegration(),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/plugins/configs/`,
      body: [
        {
          id: 'opsgenie',
          name: 'Opsgenie',
          slug: 'opsgenie',
          projectList: [
            {
              projectId: 2,
              projectSlug: 'python',
              projectName: 'python',
              enabled: true,
              configured: true,
              projectPlatform: 'python',
            },
          ],
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/migrate-opsgenie/`,
      body: {},
    });
    render(
      <ConfigureIntegration
        {...TestStubs.routeComponentProps()}
        params={{integrationId, providerKey: 'opsgenie'}}
        organization={org}
        location={TestStubs.location({query: {}})}
      />
    );
    expect(screen.getByRole('button', {name: 'Migrate Plugin'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Migrate Plugin'}));
  });
});
