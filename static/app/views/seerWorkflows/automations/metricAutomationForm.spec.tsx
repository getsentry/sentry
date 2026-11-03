import {Outlet} from 'react-router';
import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import AutomationDetail from 'sentry/views/seerWorkflows/automations/detail';
import AutomationConfiguration from 'sentry/views/seerWorkflows/automations/detail/configuration';
import {MetricAutomationForm} from 'sentry/views/seerWorkflows/automations/metricAutomationForm';
import NewMetricAutomation from 'sentry/views/seerWorkflows/automations/new';

describe('MetricAutomationForm', () => {
  const organization = OrganizationFixture({
    features: ['seer-automations', 'service-accounts'],
    access: [...OrganizationFixture().access, 'event:read', 'event:write', 'member:read'],
  });
  const configsUrl = `/organizations/${organization.slug}/seer/workflows/configs/`;
  const accountsUrl = `/organizations/${organization.slug}/service-accounts/`;
  const account = {
    id: '5',
    name: 'Checkout investigation agent',
    scopes: ['event:read', 'member:read', 'org:read', 'project:read', 'team:read'],
    projectIds: ['1', '2'],
    allProjects: false,
    isActive: true,
  };
  const config = SeerWorkflowConfigFixture({
    id: '42',
    name: 'Checkout errors',
    strategy: 'breached_metric_investigation',
    enabled: false,
    monitorIds: [1],
    projects: [1],
    serviceAccountId: account.id,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'checkout-api'}),
      ProjectFixture({id: '2', slug: 'payments-worker'}),
    ]);
    MockApiClient.addMockResponse({url: accountsUrl, method: 'POST', body: account});
    MockApiClient.addMockResponse({url: `${accountsUrl}5/`, body: account});
    MockApiClient.addMockResponse({
      url: `${accountsUrl}5/`,
      method: 'PUT',
      body: account,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [
        MetricDetectorFixture({id: '1', name: 'Checkout error rate'}),
        MetricDetectorFixture({id: '2', name: 'Payment failures'}),
      ],
    });
    MockApiClient.addMockResponse({
      url: configsUrl,
      body: {configs: [config]},
    });
  });

  it('creates a paused metric automation and opens its saved configuration', async () => {
    MockApiClient.addMockResponse({
      url: `${accountsUrl}5/`,
      body: {...account, scopes: [...account.scopes, 'event:write']},
    });
    const createAccount = MockApiClient.addMockResponse({
      url: accountsUrl,
      method: 'POST',
      body: {...account, scopes: [...account.scopes, 'event:write']},
    });
    const create = MockApiClient.addMockResponse({
      url: configsUrl,
      method: 'POST',
      body: config,
    });
    const {router} = render(<Outlet />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/seer/automations/new/'},
        route: '/organizations/:orgId/seer/automations/',
        children: [
          {path: 'new/', element: <NewMetricAutomation />},
          {
            path: ':automationId/',
            element: <AutomationDetail />,
            children: [{index: true, element: <AutomationConfiguration />}],
          },
        ],
      },
    });

    expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue(
      'Breached Metric Investigation'
    );
    expect(screen.getByText('No monitors connected')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: 'Start investigations'})
    ).not.toBeChecked();
    await userEvent.clear(screen.getByRole('textbox', {name: 'Name'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Checkout errors');
    await userEvent.click(screen.getByRole('textbox', {name: 'Connected monitors'}));
    await userEvent.click(await screen.findByText('Checkout error rate · checkout-api'));
    await userEvent.click(screen.getByRole('textbox', {name: 'Agent projects'}));
    expect(screen.getByRole('menuitemcheckbox', {name: 'checkout-api'})).toBeChecked();
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', {name: 'payments-worker'})
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Permission scopes'}));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'event:write'}));
    await userEvent.click(screen.getByRole('button', {name: 'Create automation'}));

    expect(await screen.findByRole('button', {name: 'Save changes'})).toBeInTheDocument();
    expect(router.location.pathname).toBe('/organizations/org-slug/seer/automations/42/');
    expect(create).toHaveBeenCalledWith(
      configsUrl,
      expect.objectContaining({
        data: {
          strategy: 'breached_metric_investigation',
          name: 'Checkout errors',
          enabled: false,
          monitorIds: [1],
          serviceAccountId: account.id,
        },
      })
    );
    expect(createAccount).toHaveBeenCalledWith(
      accountsUrl,
      expect.objectContaining({
        data: expect.objectContaining({
          projectIds: [1, 2],
          scopes: [...account.scopes, 'event:write'],
          allProjects: false,
        }),
      })
    );
    expect(screen.getByRole('link', {name: 'Checkout error rate'})).toBeInTheDocument();
    expect(screen.queryByText(/Next run/)).not.toBeInTheDocument();
  });

  it('saves monitor connections and the investigation toggle independently of agent access', async () => {
    const updateAccount = MockApiClient.addMockResponse({
      url: `${accountsUrl}5/`,
      method: 'PUT',
      body: account,
    });
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
      await screen.findByRole('button', {
        name: 'Disconnect Checkout error rate',
      })
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Connected monitors'}));
    await userEvent.click(await screen.findByText('Payment failures · checkout-api'));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Start investigations'}));
    MockApiClient.addMockResponse({
      url: configsUrl,
      body: {configs: [{...config, monitorIds: [2], enabled: true}]},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        `${configsUrl}42/`,
        expect.objectContaining({data: {monitorIds: [2], enabled: true}})
      )
    );
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Save changes'})).toBeEnabled()
    );
    expect(screen.getByRole('checkbox', {name: 'Start investigations'})).toBeChecked();

    const clear = MockApiClient.addMockResponse({
      url: `${configsUrl}42/`,
      method: 'PUT',
      body: {...config, monitorIds: []},
    });
    MockApiClient.addMockResponse({
      url: configsUrl,
      body: {configs: [{...config, monitorIds: []}]},
    });
    await userEvent.click(
      screen.getByRole('button', {name: 'Disconnect Payment failures'})
    );
    await userEvent.click(screen.getByRole('checkbox', {name: 'Start investigations'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));
    await waitFor(() =>
      expect(clear).toHaveBeenCalledWith(
        `${configsUrl}42/`,
        expect.objectContaining({data: {monitorIds: [], enabled: false}})
      )
    );
    expect(screen.getByText('No monitors connected')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: 'Start investigations'})
    ).not.toBeChecked();
    expect(updateAccount).toHaveBeenLastCalledWith(
      `${accountsUrl}5/`,
      expect.objectContaining({
        data: {projectIds: [1, 2], scopes: account.scopes, allProjects: false},
      })
    );
  });

  it('updates each project’s environments as monitors are connected and disconnected', async () => {
    const productionSource = SnubaQueryDataSourceFixture();
    productionSource.queryObj.snubaQuery.environment = 'production';
    const stagingSource = SnubaQueryDataSourceFixture();
    stagingSource.queryObj.snubaQuery.environment = 'staging';
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'checkout-api'}),
      ProjectFixture({id: '2', slug: 'payments-worker'}),
    ]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [
        MetricDetectorFixture({
          id: '1',
          name: 'Checkout error rate',
          dataSources: [productionSource],
        }),
        MetricDetectorFixture({
          id: '2',
          name: 'Payment failures',
          projectId: '2',
          dataSources: [stagingSource],
        }),
        MetricDetectorFixture({id: '3', name: 'All checkout errors'}),
      ],
    });
    render(
      <MetricAutomationForm mode="edit" config={{...config, monitorIds: [1, 2]}} />,
      {
        organization,
      }
    );

    expect(await screen.findByText('production')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('textbox', {name: 'Connected monitors'}));
    await userEvent.click(await screen.findByText('All checkout errors · checkout-api'));
    expect(screen.getByText('All environments')).toBeInTheDocument();
    expect(screen.queryByText('production')).not.toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'Disconnect All checkout errors'})
    );
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.queryByText('All environments')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'Disconnect Payment failures'})
    );
    expect(screen.queryByText('staging')).not.toBeInTheDocument();
  });

  it('keeps the selected monitors when the API rejects the update', async () => {
    MockApiClient.addMockResponse({
      url: `${configsUrl}42/`,
      method: 'PUT',
      statusCode: 400,
      body: {
        detail: 'Selected monitors must be active metric monitors in this organization.',
      },
    });
    render(<MetricAutomationForm mode="edit" config={config} />, {
      organization,
    });

    await screen.findByRole('link', {name: 'Checkout error rate'});
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    expect(
      await screen.findByText(
        'Selected monitors must be active metric monitors in this organization.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Checkout error rate'})).toBeInTheDocument();
  });
});
