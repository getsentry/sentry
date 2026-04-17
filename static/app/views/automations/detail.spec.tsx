import type {ReactNode} from 'react';
import {
  ActionFilterFixture,
  ActionFixture,
  AutomationFixture,
} from 'sentry-fixture/automations';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import AutomationDetail from 'sentry/views/automations/detail';
import {TopBar} from 'sentry/views/navigation/topBar';

function TopBarSlotWrapper({children}: {children: ReactNode}) {
  return (
    <TopBar.Slot.Provider>
      <TopBar.Slot.Outlet name="title">
        {props => <div {...props} data-test-id="topbar-title-slot" />}
      </TopBar.Slot.Outlet>
      <TopBar.Slot.Outlet name="actions">
        {props => <div {...props} data-test-id="topbar-actions-slot" />}
      </TopBar.Slot.Outlet>
      {children}
    </TopBar.Slot.Provider>
  );
}

describe('AutomationDetail', () => {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});
  const automation = AutomationFixture({
    id: '123',
    name: 'Test Automation',
    detectorIds: ['1', '2'],
  });
  const user = UserFixture({id: '1', name: 'John Doe', email: 'john@example.com'});
  const detectors = [
    MetricDetectorFixture({id: '1', name: 'CPU Usage Monitor', projectId: '1'}),
    MetricDetectorFixture({id: '2', name: 'Memory Usage Monitor', projectId: '2'}),
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      body: user,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/',
      body: automation,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: detectors,
      match: [MockApiClient.matchQuery({id: ['1', '2']})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/stats/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/group-history/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      method: 'GET',
      body: [],
    });
  });

  it('displays automation details correctly', async () => {
    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    expect(
      await screen.findByRole('heading', {name: 'Test Automation'})
    ).toBeInTheDocument();

    // Check sidebar sections
    expect(screen.getByRole('heading', {name: 'Last Triggered'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Environment'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Throttling'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Conditions'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Details'})).toBeInTheDocument();
  });

  it('can disable an enabled automation', async () => {
    const disabledAutomation = AutomationFixture({
      ...automation,
      enabled: false,
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/',
      method: 'PUT',
      body: {...disabledAutomation, enabled: false},
    });

    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    const enableButton = await screen.findByRole('button', {name: 'Disable'});
    await userEvent.click(enableButton);

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/workflows/123/',
        expect.objectContaining({
          data: {
            id: '123',
            name: 'Test Automation',
            enabled: false,
          },
        })
      );
    });

    expect(screen.getAllByText('Enable')).toHaveLength(2);
  });

  it('renders breadcrumbs and actions in the top bar when page frame is enabled', async () => {
    const pageFrameOrg = OrganizationFixture({
      features: ['workflow-engine-ui', 'page-frame'],
    });

    render(<AutomationDetail />, {
      organization: pageFrameOrg,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
      additionalWrapper: TopBarSlotWrapper,
    });

    const topBarTitle = screen.getByTestId('topbar-title-slot');
    const breadcrumbs = await within(topBarTitle).findByTestId('breadcrumb-list');
    expect(within(breadcrumbs).getByRole('link', {name: 'Alerts'})).toBeInTheDocument();
    expect(await within(topBarTitle).findByText('Test Automation')).toBeInTheDocument();

    const topBarActions = screen.getByTestId('topbar-actions-slot');
    expect(
      await within(topBarActions).findByRole('button', {name: 'Disable'})
    ).toBeInTheDocument();
    expect(
      await within(topBarActions).findByRole('button', {name: 'Edit'})
    ).toBeInTheDocument();

    expect(screen.getAllByRole('button', {name: 'Disable'})).toHaveLength(1);
    expect(screen.getAllByRole('button', {name: 'Edit'})).toHaveLength(1);
  });

  describe('Action warnings', () => {
    it('displays warning when alert has no actions', async () => {
      const automationWithWarning = AutomationFixture({
        ...automation,
        actionFilters: [ActionFilterFixture({actions: []})],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/123/',
        body: automationWithWarning,
      });

      render(<AutomationDetail />, {
        organization,
        initialRouterConfig: {
          route: '/alerts/:automationId/',
          location: {pathname: '/alerts/123/'},
        },
      });

      await screen.findByRole('heading', {name: 'Test Automation'});

      expect(
        screen.getByText('You must add an action for this alert to run.')
      ).toBeInTheDocument();
    });

    it('displays warning all actions are invalid', async () => {
      const automationWithWarning = AutomationFixture({
        ...automation,
        actionFilters: [
          ActionFilterFixture({
            actions: [ActionFixture({status: 'disabled'})],
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/123/',
        body: automationWithWarning,
      });

      render(<AutomationDetail />, {
        organization,
        initialRouterConfig: {
          route: '/alerts/:automationId/',
          location: {pathname: '/alerts/123/'},
        },
      });

      await screen.findByRole('heading', {name: 'Test Automation'});

      expect(
        screen.getByText(
          'Alert is invalid because no actions can run. Actions need to be reconfigured.'
        )
      ).toBeInTheDocument();
    });

    it('displays warning some actions are invalid', async () => {
      const automationWithWarning = AutomationFixture({
        ...automation,
        actionFilters: [
          ActionFilterFixture({
            actions: [ActionFixture(), ActionFixture({status: 'disabled'})],
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/123/',
        body: automationWithWarning,
      });

      render(<AutomationDetail />, {
        organization,
        initialRouterConfig: {
          route: '/alerts/:automationId/',
          location: {pathname: '/alerts/123/'},
        },
      });

      await screen.findByRole('heading', {name: 'Test Automation'});

      expect(
        screen.getByText('One or more actions need to be reconfigured in order to run.')
      ).toBeInTheDocument();
    });
  });
});
