import {Fragment} from 'react';
import {
  ActionFilterFixture,
  ActionFixture,
  AutomationFixture,
} from 'sentry-fixture/automations';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ActionTarget, ActionType} from 'sentry/types/workflowEngine/actions';

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

  // The edit form's save button lives in the page header, so render one that targets it
  function renderEditForm(editConfig: typeof config) {
    render(
      <Fragment>
        <MetricAutomationForm
          mode="edit"
          config={editConfig}
          formId="automation-form"
          formRef={{current: null}}
          onSaved={jest.fn()}
          readOnly={false}
        />
        <button type="submit" form="automation-form">
          Save changes
        </button>
      </Fragment>,
      {organization}
    );
  }

  function expectNoServiceAccountRequests() {
    expect(requestSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/service-accounts/'),
      expect.anything()
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      body: [
        AutomationFixture({
          detectorIds: ['1'],
          actionFilters: [
            ActionFilterFixture({
              actions: [
                ActionFixture({
                  type: ActionType.SLACK,
                  config: {
                    targetType: ActionTarget.SPECIFIC,
                    targetIdentifier: 'C123',
                    targetDisplay: '#checkout-alerts',
                  },
                }),
              ],
            }),
          ],
        }),
      ],
    });
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
    await userEvent.click(screen.getByRole('button', {name: 'Connect monitors'}));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Connect Checkout error rate'})
    );
    expect(await screen.findAllByText('#checkout-alerts')).not.toHaveLength(0);
    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
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
    renderEditForm(allProjectsConfig);

    await screen.findByText('Checkout error rate');
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
    renderEditForm({...config, serviceAccount: null});

    await screen.findByText('Checkout error rate');
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

    await userEvent.click(await screen.findByRole('button', {name: 'Configure'}));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Disconnect Checkout error rate'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Connect monitors'}));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Connect Payment failures'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Start investigations'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        `${configsUrl}42/`,
        expect.objectContaining({data: {monitorIds: [2], enabled: true, serviceAccount}})
      )
    );
    expectNoServiceAccountRequests();
  });

  it('shows the API error when saving fails', async () => {
    MockApiClient.addMockResponse({
      url: `${configsUrl}42/`,
      method: 'PUT',
      statusCode: 400,
      body: {detail: 'Selected monitors must be active metric monitors.'},
    });
    renderEditForm(config);

    await screen.findByText('Checkout error rate');
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    // Shown in both the inline alert and the toast
    expect(
      await screen.findAllByText('Selected monitors must be active metric monitors.')
    ).toHaveLength(2);
  });
});
