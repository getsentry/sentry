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

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

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
          name={editConfig.name ?? ''}
          setFormHasChanges={jest.fn()}
          setMonitorsPending={jest.fn()}
        />
        <button type="submit" form="automation-form">
          Save changes
        </button>
      </Fragment>,
      {organization}
    );
  }

  // Save errors show both as a toast and as an inline alert above the form
  async function expectSaveErrorShown(message: string) {
    // The error toast has the alert role; the inline alert has no role
    const toast = await screen.findByRole('alert');
    expect(within(toast).getByText(message)).toBeInTheDocument();
    expect(screen.getAllByText(message).filter(el => !toast.contains(el))).toHaveLength(
      1
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
        MetricDetectorFixture({id: '2', name: 'Payment failures', projectId: '2'}),
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
      screen.getByRole('button', {name: /1 project · 5 permissions/})
    );
    expect(screen.getByText('1 connected monitor')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Remove checkout-api'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Add projects'}));
    await userEvent.click(screen.getByRole('option', {name: 'payments-worker'}));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', {name: 'Remove payments-worker'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Issue & Event permission'}));
    expect(screen.getByRole('option', {name: 'Admin'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await userEvent.click(screen.getByRole('option', {name: 'Read & Write'}));
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
            scopes: [...serviceAccount.scopes, 'event:write'].sort(),
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
            name: 'Checkout errors',
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
            name: 'Checkout errors',
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

  it('drops a project from the service account with its last monitor', async () => {
    const update = MockApiClient.addMockResponse({
      url: `${configsUrl}42/`,
      method: 'PUT',
      body: {...config, monitorIds: [2]},
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
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        `${configsUrl}42/`,
        expect.objectContaining({
          data: {
            monitorIds: [2],
            name: 'Checkout errors',
            serviceAccount: {...serviceAccount, projectIds: [2]},
          },
        })
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
    await expectSaveErrorShown('Selected monitors must be active metric monitors.');
  });

  describe('configure mode', () => {
    function renderDetailPage() {
      render(<AutomationDetail />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/seer/automations/42/'},
          route: '/organizations/:orgId/seer/automations/:automationId/',
          children: [
            {index: true, element: <AutomationConfiguration />},
            // Only the navigation matters here, so the runs tab is a stand-in
            {path: 'runs/', element: <div>Runs tab</div>},
          ],
        },
      });
    }

    it('locks the form until configuring and returns to the default actions after saving', async () => {
      const update = MockApiClient.addMockResponse({
        url: `${configsUrl}42/`,
        method: 'PUT',
        body: {...config, monitorIds: []},
      });
      renderDetailPage();

      // Fields are locked before configuring
      expect(
        await screen.findByRole('button', {name: 'Disconnect Checkout error rate'})
      ).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Connect monitors'})).toBeDisabled();

      await userEvent.click(screen.getByRole('button', {name: 'Configure'}));

      // The default actions are swapped for Cancel and Save
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Configure'})).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Connect monitors'})).toBeEnabled();

      await userEvent.click(
        screen.getByRole('button', {name: 'Disconnect Checkout error rate'})
      );
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => expect(update).toHaveBeenCalled());
      expect(await screen.findByRole('button', {name: 'Configure'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Connect monitors'})).toBeDisabled();
    });

    it('enables save only while there are changes', async () => {
      renderDetailPage();

      await userEvent.click(await screen.findByRole('button', {name: 'Configure'}));
      expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();

      // Renaming enables save, and restoring the name disables it again
      await userEvent.click(screen.getByTestId('editable-text-label'));
      await userEvent.type(screen.getByRole('textbox', {name: 'Automation Name'}), '!');
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();

      expect(screen.getByTestId('editable-text-label')).toHaveTextContent(
        'Checkout errors!'
      );
      await userEvent.click(screen.getByTestId('editable-text-label'));
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Automation Name'}),
        '{Backspace}'
      );
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();

      // Changing a field also enables save
      await userEvent.click(
        await screen.findByRole('button', {name: 'Disconnect Checkout error rate'})
      );
      expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
    });

    it('discards changes when cancelled', async () => {
      const update = MockApiClient.addMockResponse({
        url: `${configsUrl}42/`,
        method: 'PUT',
        body: config,
      });
      renderDetailPage();

      await userEvent.click(await screen.findByRole('button', {name: 'Configure'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'Disconnect Checkout error rate'})
      );
      expect(screen.queryByText('Checkout error rate')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      expect(await screen.findByText('Checkout error rate')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Configure'})).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
    });

    it('cancels configuring when leaving the configuration tab', async () => {
      const update = MockApiClient.addMockResponse({
        url: `${configsUrl}42/`,
        method: 'PUT',
        body: config,
      });
      renderDetailPage();

      await userEvent.click(await screen.findByRole('button', {name: 'Configure'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'Disconnect Checkout error rate'})
      );
      await userEvent.click(screen.getByRole('tab', {name: 'Runs'}));

      expect(await screen.findByText('Runs tab')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Configure'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

      // Returning shows the saved values, still locked
      await userEvent.click(screen.getByRole('tab', {name: 'Configuration'}));
      expect(
        await screen.findByRole('button', {name: 'Disconnect Checkout error rate'})
      ).toBeDisabled();
      expect(update).not.toHaveBeenCalled();
    });

    it('saves a renamed automation', async () => {
      const update = MockApiClient.addMockResponse({
        url: `${configsUrl}42/`,
        method: 'PUT',
        body: {...config, name: 'Checkout triage'},
      });
      renderDetailPage();

      await userEvent.click(await screen.findByRole('button', {name: 'Configure'}));
      await userEvent.click(screen.getByTestId('editable-text-label'));
      const nameInput = screen.getByRole('textbox', {name: 'Automation Name'});
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Checkout triage{Enter}');
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          `${configsUrl}42/`,
          expect.objectContaining({
            data: expect.objectContaining({name: 'Checkout triage'}),
          })
        )
      );
    });

    it('stays in configure mode when saving fails', async () => {
      MockApiClient.addMockResponse({
        url: `${configsUrl}42/`,
        method: 'PUT',
        statusCode: 400,
        body: {detail: 'Selected monitors must be active metric monitors.'},
      });
      renderDetailPage();

      await userEvent.click(await screen.findByRole('button', {name: 'Configure'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'Disconnect Checkout error rate'})
      );
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await expectSaveErrorShown('Selected monitors must be active metric monitors.');
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Configure'})).not.toBeInTheDocument();
    });

    it('disables pausing and configuring while an update is in flight', async () => {
      let finishRequest!: () => void;
      MockApiClient.addMockResponse({
        url: `${configsUrl}42/`,
        method: 'PUT',
        body: {...config, enabled: true},
        // Holds the response until the test releases it
        asyncDelay: new Promise<void>(resolve => {
          finishRequest = resolve;
        }),
      });
      renderDetailPage();

      await userEvent.click(await screen.findByRole('button', {name: 'Enable'}));

      // This button marks itself disabled with aria-disabled rather than the disabled attribute
      expect(screen.getByRole('button', {name: 'Enable'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('button', {name: 'Configure'})).toBeDisabled();

      finishRequest();

      await waitFor(() =>
        expect(screen.getByRole('button', {name: 'Configure'})).toBeEnabled()
      );
    });

    it('keeps save disabled while connected monitors are loading', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        body: [MetricDetectorFixture({id: '1', name: 'Checkout error rate'})],
        // Never responds, so the monitors stay loading
        asyncDelay: new Promise<void>(() => {}),
      });
      renderDetailPage();

      await userEvent.click(await screen.findByRole('button', {name: 'Configure'}));

      // Renaming would normally enable save
      await userEvent.click(screen.getByTestId('editable-text-label'));
      await userEvent.type(screen.getByRole('textbox', {name: 'Automation Name'}), '!');
      await userEvent.keyboard('{Enter}');

      expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    });
  });
});
