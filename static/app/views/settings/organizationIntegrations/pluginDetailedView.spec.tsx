import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';
import PluginDetailedView from 'sentry/views/settings/organizationIntegrations/pluginDetailedView';

function renderMockRequests(orgSlug: Organization['slug']) {
  const configs = MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/plugins/configs/?plugins=pagerduty`,
    method: 'GET',
    statusCode: 200,
    body: [
      {
        status: 'unknown',
        description: 'Send alerts to PagerDuty.',
        isTestable: true,
        isHidden: true,
        hasConfiguration: true,
        features: [],
        shortName: 'PagerDuty',
        id: 'pagerduty',
        assets: [],
        featureDescriptions: [],
        name: 'PagerDuty',
        author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
        contexts: [],
        doc: '',
        resourceLinks: [
          {url: 'https://github.com/getsentry/sentry/issues', title: 'Report Issue'},
          {
            url: 'https://github.com/getsentry/sentry/tree/master/src/sentry_plugins',
            title: 'View Source',
          },
        ],
        slug: 'pagerduty',
        projectList: [
          {
            projectId: 2,
            configured: true,
            enabled: true,
            projectSlug: 'javascript',

            projectPlatform: 'javascript',
            projectName: 'JavaScript',
          },
        ],
        version: '10.1.0.dev0',
        canDisable: true,
        type: 'notification',
        metadata: {},
      },
    ],
  });

  return {configs};
}

describe('PluginDetailedView', function () {
  it('shows the Integration name and install status', async function () {
    const {route, router, organization} = initializeOrg();

    renderMockRequests(organization.slug);

    render(
      <PluginDetailedView
        params={{integrationSlug: 'pagerduty'}}
        route={route}
        routes={[]}
        routeParams={{}}
        router={router}
        location={router.location}
      />
    );

    expect(await screen.findByText('PagerDuty (Legacy)')).toBeInTheDocument();

    expect(screen.getByText('Installed')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Add to Project'}));

    renderGlobalModal();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('view configurations', function () {
    const {route, router, organization} = initializeOrg({
      router: {location: {query: {tab: 'configurations'}}},
    });

    renderMockRequests(organization.slug);

    render(
      <PluginDetailedView
        params={{integrationSlug: 'pagerduty'}}
        route={route}
        routes={[]}
        routeParams={{}}
        router={router}
        location={router.location}
      />
    );

    expect(screen.getByTestId('installed-plugin')).toBeInTheDocument();
  });
});
