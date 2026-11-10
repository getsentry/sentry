import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import AutomationConfiguration from './detail/configuration';
import AutomationDetail from './detail';
import {MetricAutomationForm} from './metricAutomationForm';
import NewMetricAutomation from './new';

describe('MetricAutomationForm', () => {
  const organization = OrganizationFixture({
    features: ['seer-automations', 'service-accounts'],
    access: [...OrganizationFixture().access, 'event:read', 'event:write', 'member:read'],
  });
  const configsUrl = `/organizations/${organization.slug}/seer/workflows/configs/`;
  const serviceAccount = {
    scopes: ['event:read', 'member:read', 'org:read', 'project:read', 'team:read'],
    projectIds: [1, 2],
    allProjects: false,
  };
  const config = SeerWorkflowConfigFixture({
    id: '42',
    name: 'Checkout errors',
    strategy: 'breached_metric_investigation',
    enabled: false,
    monitorIds: [1],
    projects: [1],
    serviceAccount: {...serviceAccount, serviceAccountId: '5'},
  });
  let requestSpy: jest.SpyInstance;

  function expectNoServiceAccountRequests() {
    expect(requestSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/service-accounts/'),
      expect.anything()
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'checkout-api'}),
      ProjectFixture({id: '2', slug: 'payments-worker'}),
    ]);
    requestSpy = jest.spyOn(MockApiClient.prototype, 'request');
    MockApiClient.addMockResponse({url: configsUrl, body: {configs: [config]}});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [
        MetricDetectorFixture({id: '1', name: 'Checkout error rate'}),
        MetricDetectorFixture({id: '2', name: 'Payment failures'}),
      ],
    });
  });

  afterEach(() => {
    requestSpy.mockRestore();
  });

  it('creates an automation with its service account settings', async () => {
    const create = MockApiClient.addMockResponse({
      url: configsUrl,
      method: 'POST',
      body: config,
    });
    const {router} = render(<NewMetricAutomation />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/seer/automations/new/'},
      },
    });

    const name = screen.getByRole('textbox', {name: 'Name'});
    await userEvent.clear(name);
    await userEvent.type(name, 'Checkout errors');
    await userEvent.click(screen.getByRole('textbox', {name: 'Connected monitors'}));
    await userEvent.click(await screen.findByText('Checkout error rate · checkout-api'));
    await userEvent.click(
      screen.getByRole('textbox', {name: 'Service account projects'})
    );
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', {name: 'payments-worker'})
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Permission scopes'}));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'event:write'}));
    await userEvent.click(screen.getByRole('button', {name: 'Create automation'}));

    await waitFor(() =>
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/seer/automations/42/'
      )
    );
    expect(create).toHaveBeenCalledWith(
      configsUrl,
      expect.objectContaining({
        data: {
          strategy: 'breached_metric_investigation',
          name: 'Checkout errors',
          enabled: false,
          monitorIds: [1],
          serviceAccount: {
            scopes: [...serviceAccount.scopes, 'event:write'],
            projectIds: [1, 2],
            allProjects: false,
          },
        },
      })
    );
    expectNoServiceAccountRequests();
  });

  it('keeps all-project access without listing project IDs', async () => {
    const allProjectsServiceAccount = {
      ...serviceAccount,
      projectIds: [],
      allProjects: true,
    };
    const allProjectsConfig = {
      ...config,
      serviceAccount: {...allProjectsServiceAccount, serviceAccountId: '5'},
    };
    const update = MockApiClient.addMockResponse({
      url: `${configsUrl}42/`,
      method: 'PUT',
      body: allProjectsConfig,
    });
    render(<MetricAutomationForm mode="edit" config={allProjectsConfig} />, {
      organization,
    });

    await screen.findByRole('link', {name: 'Checkout error rate'});
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        `${configsUrl}42/`,
        expect.objectContaining({
          data: {
            monitorIds: [1],
            enabled: false,
            serviceAccount: allProjectsServiceAccount,
          },
        })
      )
    );
  });

  it('defaults service account access to the monitor projects when there is no service account', async () => {
    const update = MockApiClient.addMockResponse({
      url: `${configsUrl}42/`,
      method: 'PUT',
      body: config,
    });
    render(
      <MetricAutomationForm mode="edit" config={{...config, serviceAccount: null}} />,
      {
        organization,
      }
    );

    await screen.findByRole('link', {name: 'Checkout error rate'});
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        `${configsUrl}42/`,
        expect.objectContaining({
          data: {
            monitorIds: [1],
            enabled: false,
            serviceAccount: {
              scopes: serviceAccount.scopes,
              projectIds: [1],
              allProjects: false,
            },
          },
        })
      )
    );
  });

  it('saves monitors and the investigation toggle without changing service account access', async () => {
    const update = MockApiClient.addMockResponse({
      url: `${configsUrl}42/`,
      method: 'PUT',
      body: {...config, monitorIds: [2], enabled: true},
    });
    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/seer/automations/42/'},
        route: '/organizations/:orgId/seer/automations/:automationId/',
        children: [{index: true, element: <AutomationConfiguration />}],
      },
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Disconnect Checkout error rate'})
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Connected monitors'}));
    await userEvent.click(await screen.findByText('Payment failures · checkout-api'));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Start investigations'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        `${configsUrl}42/`,
        expect.objectContaining({data: {monitorIds: [2], enabled: true, serviceAccount}})
      )
    );
    expectNoServiceAccountRequests();
  });

  it('lists environments for each connected monitor project', async () => {
    const productionSource = SnubaQueryDataSourceFixture();
    productionSource.queryObj.snubaQuery.environment = 'production';
    const stagingSource = SnubaQueryDataSourceFixture();
    stagingSource.queryObj.snubaQuery.environment = 'staging';
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [
        MetricDetectorFixture({id: '1', dataSources: [productionSource]}),
        MetricDetectorFixture({id: '2', projectId: '2', dataSources: [stagingSource]}),
        MetricDetectorFixture({id: '3'}),
      ],
    });
    render(
      <MetricAutomationForm mode="edit" config={{...config, monitorIds: [1, 2, 3]}} />,
      {organization}
    );

    expect(await screen.findByText('staging')).toBeInTheDocument();
    expect(screen.getByText('All environments')).toBeInTheDocument();
    expect(screen.queryByText('production')).not.toBeInTheDocument();
  });

  it('shows the API error when saving fails', async () => {
    MockApiClient.addMockResponse({
      url: `${configsUrl}42/`,
      method: 'PUT',
      statusCode: 400,
      body: {detail: 'Selected monitors must be active metric monitors.'},
    });
    render(<MetricAutomationForm mode="edit" config={config} />, {organization});

    await screen.findByRole('link', {name: 'Checkout error rate'});
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    expect(
      await screen.findByText('Selected monitors must be active metric monitors.')
    ).toBeInTheDocument();
  });
});
