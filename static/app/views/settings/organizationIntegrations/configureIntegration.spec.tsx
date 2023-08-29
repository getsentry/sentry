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
        providers: [
          {
            key: 'opsgenie',
            slug: 'opsgenie',
            name: 'Opsgenie (Integration)',
            metadata: {
              description: 'hi',
              features: [
                {
                  description:
                    'Manage incidents and outages by sending Sentry notifications to Opsgenie.',
                  featureGate: 'integrations-incident-management',
                },
                {
                  description:
                    'Configure rule based Opsgenie alerts that automatically trigger and notify specific teams.',
                  featureGate: 'integrations-alert-rule',
                },
              ],
              author: 'The Sentry Team',
              noun: 'Installation',
              issue_url:
                'https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Integration%20Problem',
              source_url:
                'https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/opsgenie',
              aspects: {},
            },
            canAdd: true,
            canDisable: false,
            features: ['alert-rule', 'incident-management'],
            setupDialog: {
              url: '/organizations/sentry/integrations/opsgenie/setup/',
              width: 600,
              height: 600,
            },
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/`,
      body: {
        id: '1',
        name: 'hello-world',
        icon: null,
        domainName: 'hello-world.app.opsgenie.com',
        accountType: null,
        scopes: null,
        status: 'active',
        provider: {
          key: 'opsgenie',
          slug: 'opsgenie',
          name: 'Opsgenie (Integration)',
          canAdd: true,
          canDisable: false,
          features: ['alert-rule', 'incident-management'],
          aspects: {},
        },
        configOrganization: [
          {
            name: 'team_table',
            type: 'table',
            label: 'Opsgenie integrations',
            help: "If integration keys need to be updated, deleted, or added manually please do so here. Your keys must be associated with a 'Sentry' Integration in Opsgenie.                 Alert rules will need to be individually updated for any key additions or deletions.",
            addButtonText: '',
            columnLabels: {
              team: 'Label',
              integration_key: 'Integration Key',
            },
            columnKeys: ['team', 'integration_key'],
            confirmDeleteMessage:
              'Any alert rules associated with this integration will stop working. The rules will still exist but will show a `removed` team.',
          },
        ],
        configData: {
          team_table: [
            {
              team: 'python [MIGRATED]',
              id: '1-python',
              integration_key: 'abcdef',
            },
          ],
        },
        externalId: 'hello-world',
        organizationId: 1,
        organizationIntegrationStatus: 'active',
        gracePeriodEnd: null,
      },
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
