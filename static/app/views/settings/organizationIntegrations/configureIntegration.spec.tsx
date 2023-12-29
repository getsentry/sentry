import {OpsgenieIntegration} from 'sentry-fixture/opsgenieIntegration';
import {OpsgenieIntegrationProvider} from 'sentry-fixture/opsgenieIntegrationProvider';
import {Organization} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfigureIntegration from 'sentry/views/settings/organizationIntegrations/configureIntegration';

describe('OpsgenieMigrationButton', function () {
  const org = Organization({
    access: ['org:integrations', 'org:write'],
  });
  const integrationId = '1';
  it('Migrate Plugin button hits migration endpoint', async function () {
    org.features.push('integrations-opsgenie-migration');
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/`,
      body: {
        providers: [OpsgenieIntegrationProvider()],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/`,
      body: OpsgenieIntegration(),
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

    const onConfirmCall = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/migrate-opsgenie/`,
      method: 'PUT',
    });

    render(
      <ConfigureIntegration
        {...RouteComponentPropsFixture()}
        params={{integrationId, providerKey: 'opsgenie'}}
      />,
      {organization: org}
    );
    renderGlobalModal();
    expect(await screen.findByRole('button', {name: 'Migrate Plugin'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Migrate Plugin'}));

    expect(screen.queryByRole('button', {name: 'Confirm'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(onConfirmCall).toHaveBeenCalled();
  });
});
