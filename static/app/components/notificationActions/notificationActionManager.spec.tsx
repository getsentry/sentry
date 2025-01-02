import {AvailableNotificationActionsFixture} from 'sentry-fixture/availableNotificationActions';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import NotificationActionManager from 'sentry/components/notificationActions/notificationActionManager';
import type {NotificationAction} from 'sentry/types/notificationActions';

describe('Adds, deletes, and updates notification actions', function () {
  const {project, organization} = initializeOrg();
  const availableActions = AvailableNotificationActionsFixture().actions;
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/notifications/available-actions/`,
    body: availableActions,
  });

  const notificationActions: NotificationAction[] = [
    {
      id: 2,
      organizationId: parseInt(organization.id, 10),
      integrationId: null,
      sentryAppId: null,
      projects: [parseInt(project.id, 10)],
      serviceType: 'sentry_notification',
      triggerType: 'spike-protection',
      targetType: 'specific',
      targetIdentifier: 'default',
      targetDisplay: 'default',
    },
    {
      id: 3,
      organizationId: parseInt(organization.id, 10),
      integrationId: 5,
      sentryAppId: null,
      projects: [parseInt(project.id, 10)],
      serviceType: 'slack',
      triggerType: 'spike-protection',
      targetType: 'specific',
      targetIdentifier: 'ABCDEFGHIJKL',
      targetDisplay: '#test-channel',
    },
    {
      id: 4,
      organizationId: parseInt(organization.id, 10),
      integrationId: 2,
      sentryAppId: null,
      projects: [parseInt(project.id, 10)],
      serviceType: 'pagerduty',
      triggerType: 'spike-protection',
      targetType: 'specific',
      targetIdentifier: '1',
      targetDisplay: 'Test 1',
    },
    {
      id: 5,
      organizationId: parseInt(organization.id, 10),
      integrationId: 3,
      sentryAppId: null,
      projects: [parseInt(project.id, 10)],
      serviceType: 'opsgenie',
      triggerType: 'spike-protection',
      targetType: 'specific',
      targetIdentifier: '1-opsgenie-test-team',
      targetDisplay: 'opsgenie-test-team',
    },
  ];

  it('renders notification actions', function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/`,
      body: notificationActions,
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={notificationActions}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );
    const projectNotificationActions = screen.queryAllByTestId('notification-action');
    expect(projectNotificationActions.length).toBe(4);
  });

  it('disables buttons and dropdowns when disabled is True', function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/`,
      body: notificationActions,
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[notificationActions[0]!]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
        disabled
      />
    );

    expect(screen.getByLabelText('Add Action')).toBeDisabled();
    expect(screen.getByTestId('edit-dropdown')).toBeDisabled();
  });

  it('Adds a Sentry notification action', async function () {
    const mockPOST = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/`,
      method: 'POST',
      body: notificationActions[0],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );

    await userEvent.click(screen.getByText('Add Action'));
    expect(screen.getByText('Send a Sentry notification')).toBeInTheDocument();
    expect(screen.getByText('Send a Slack notification')).toBeInTheDocument();
    expect(screen.getByText('Send a Pagerduty notification')).toBeInTheDocument();
    expect(screen.getByText('Send an Opsgenie notification')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Send a Sentry notification'));

    // Can only have 1 sentry notification
    await userEvent.click(screen.getByText('Add Action'));
    expect(screen.queryByText('Send a Sentry notification')).not.toBeInTheDocument();
    expect(screen.getByText('Send a Slack notification')).toBeInTheDocument();
    expect(screen.getByText('Send a Pagerduty notification')).toBeInTheDocument();
    expect(screen.getByText('Send an Opsgenie notification')).toBeInTheDocument();

    expect(screen.getByTestId('sentry_notification-form')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Save'));
    expect(mockPOST).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/notifications/actions/`,
      expect.objectContaining({
        data: expect.objectContaining({
          projects: [project.slug],
          serviceType: 'sentry_notification',
          triggerType: 'spike-protection',
          targetType: 'specific',
          targetIdentifier: 'default',
          targetDisplay: 'default',
        }),
      })
    );
    await waitFor(() => {
      expect(screen.getByTestId('sentry_notification-action')).toBeInTheDocument();
    });
  });

  it('Removes a Sentry notification action', async function () {
    const mockDELETE = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/${notificationActions[0]!.id}/`,
      method: 'DELETE',
      body: [],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[notificationActions[0]!]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );
    renderGlobalModal();

    await userEvent.click(screen.getByTestId('edit-dropdown'));
    await userEvent.click(screen.getByText('Delete'));
    await userEvent.click(screen.getByText('Confirm'));

    expect(mockDELETE).toHaveBeenCalled();
    expect(screen.queryByTestId('sentry_notification-action')).not.toBeInTheDocument();
  });

  it('Adds a Slack action', async function () {
    const mockPOST = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/`,
      method: 'POST',
      body: notificationActions[1],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );

    await userEvent.click(screen.getByText('Add Action'));
    await userEvent.click(screen.getByText('Send a Slack notification'));

    expect(screen.getByTestId('slack-form')).toBeInTheDocument();
    expect(screen.getByText('sentry-ecosystem')).toBeInTheDocument();

    // Select workspace
    await userEvent.click(screen.getByTestId('slack-workspace-dropdown'));
    expect(screen.getByText('sentry-enterprise')).toBeInTheDocument();
    await userEvent.click(screen.getByText('sentry-enterprise'));

    // Type channel name
    const targetDisplay = screen.getByTestId('target-display-input');
    await userEvent.type(targetDisplay, '#test-channel');

    await userEvent.click(screen.getByText('Save'));
    expect(mockPOST).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/notifications/actions/`,
      expect.objectContaining({
        data: expect.objectContaining({
          projects: [project.slug],
          serviceType: 'slack',
          triggerType: 'spike-protection',
          targetType: 'specific',
          targetDisplay: '#test-channel',
        }),
      })
    );
    await waitFor(() => {
      expect(screen.getByTestId('slack-action')).toBeInTheDocument();
    });
  });

  it('Removes a Slack action', async function () {
    const mockDELETE = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/${notificationActions[1]!.id}/`,
      method: 'DELETE',
      body: [],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[notificationActions[1]!]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );
    renderGlobalModal();

    await userEvent.click(screen.getByTestId('edit-dropdown'));
    await userEvent.click(screen.getByText('Delete'));
    await userEvent.click(screen.getByText('Confirm'));

    expect(mockDELETE).toHaveBeenCalled();
    expect(screen.queryByTestId('slack-action')).not.toBeInTheDocument();
  });

  it('Edits a Slack action', async function () {
    const mockPUT = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/${notificationActions[1]!.id}/`,
      method: 'PUT',
      body: [
        {
          id: 3,
          organizationId: organization.id,
          integrationId: 1,
          sentryAppId: null,
          projects: [parseInt(project.id, 10)],
          serviceType: 'slack',
          triggerType: 'spike-protection',
          targetType: 'specific',
          targetIdentifier: '12345678',
          targetDisplay: '#new-channel',
        },
      ],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[notificationActions[1]!]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );

    await userEvent.click(screen.getByTestId('edit-dropdown'));
    await userEvent.click(screen.getByText('Edit'));

    // Edit workspace
    await userEvent.click(screen.getByTestId('slack-workspace-dropdown'));
    await userEvent.click(screen.getByText('sentry-ecosystem'));

    // Edit channel name
    const targetDisplay = screen.getByTestId('target-display-input');
    await userEvent.clear(targetDisplay);
    await userEvent.type(targetDisplay, '#new-channel');

    // Delete channel ID and leave blank
    await userEvent.clear(screen.getByTestId('target-identifier-input'));
    await userEvent.click(screen.getByText('Save'));

    expect(mockPUT).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/notifications/actions/${notificationActions[1]!.id}/`,
      expect.objectContaining({
        data: expect.objectContaining({
          id: 3,
          projects: [project.slug],
          serviceType: 'slack',
          triggerType: 'spike-protection',
          targetType: 'specific',
          integrationId: 1,
          targetDisplay: '#new-channel',
        }),
      })
    );
  });

  it('Adds a Pagerduty action', async function () {
    const mockPOST = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/`,
      method: 'POST',
      body: notificationActions[2],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );

    await userEvent.click(screen.getByText('Add Action'));
    await userEvent.click(screen.getByText('Send a Pagerduty notification'));

    expect(screen.getByTestId('pagerduty-form')).toBeInTheDocument();

    // Use default account
    expect(screen.getByText('sentry-enterprise')).toBeInTheDocument();
    expect(screen.getByText('Default Service')).toBeInTheDocument();

    // Select service
    await userEvent.click(screen.getByText('Default Service'));
    await userEvent.click(screen.getByText('Test 1'));

    await userEvent.click(screen.getByText('Save'));
    expect(mockPOST).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/notifications/actions/`,
      expect.objectContaining({
        data: expect.objectContaining({
          integrationId: 2,
          integrationName: 'sentry-enterprise',
          projects: [project.slug],
          serviceType: 'pagerduty',
          triggerType: 'spike-protection',
          targetType: 'specific',
          targetIdentifier: '1',
          targetDisplay: 'Test 1',
        }),
      })
    );
    await waitFor(() => {
      expect(screen.getByTestId('pagerduty-action')).toBeInTheDocument();
    });
  });

  it('Edits a Pagerduty action', async function () {
    const mockPUT = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/${notificationActions[2]!.id}/`,
      method: 'PUT',
      body: [
        {
          id: 4,
          organizationId: organization.id,
          integrationId: 2,
          sentryAppId: null,
          projects: [parseInt(project.id, 10)],
          serviceType: 'pagerduty',
          triggerType: 'spike-protection',
          targetType: 'specific',
          targetIdentifier: '3',
          targetDisplay: 'Default Service',
        },
      ],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[notificationActions[2]!]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );

    await userEvent.click(screen.getByTestId('edit-dropdown'));
    await userEvent.click(screen.getByText('Edit'));

    // Edit service
    await userEvent.click(screen.getByTestId('target-display-dropdown'));
    await userEvent.click(screen.getByText('Default Service'));

    await userEvent.click(screen.getByText('Save'));

    expect(mockPUT).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/notifications/actions/${notificationActions[2]!.id}/`,
      expect.objectContaining({
        data: expect.objectContaining({
          id: 4,
          projects: [project.slug],
          serviceType: 'pagerduty',
          triggerType: 'spike-protection',
          targetType: 'specific',
          integrationId: 2,
          targetIdentifier: '3',
          targetDisplay: 'Default Service',
        }),
      })
    );
  });

  it('Adds an Opsgenie action', async function () {
    const mockPOST = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/`,
      method: 'POST',
      body: notificationActions[3],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );

    await userEvent.click(screen.getByText('Add Action'));
    await userEvent.click(screen.getByText('Send an Opsgenie notification'));

    expect(screen.getByTestId('opsgenie-form')).toBeInTheDocument();

    // Use default account
    expect(screen.getByText('sentry-enterprise')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Select Team'})).toBeInTheDocument();

    // Select team
    await userEvent.click(screen.getByRole('button', {name: 'Select Team'}));
    await userEvent.click(screen.getByText('opsgenie-test-team'));

    await userEvent.click(screen.getByText('Save'));
    expect(mockPOST).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/notifications/actions/`,
      expect.objectContaining({
        data: expect.objectContaining({
          integrationId: 3,
          integrationName: 'sentry-enterprise',
          projects: [project.slug],
          serviceType: 'opsgenie',
          triggerType: 'spike-protection',
          targetType: 'specific',
          targetIdentifier: '1-opsgenie-test-team',
          targetDisplay: 'opsgenie-test-team',
        }),
      })
    );
    await waitFor(() => {
      expect(screen.getByTestId('opsgenie-action')).toBeInTheDocument();
    });
  });

  it('Edits an Opsgenie Action', async function () {
    const mockPUT = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/${notificationActions[3]!.id}/`,
      method: 'PUT',
      body: [
        {
          id: 5,
          organizationId: organization.id,
          integrationId: 4,
          sentryAppId: null,
          projects: [parseInt(project.id, 10)],
          serviceType: 'opsgenie',
          triggerType: 'spike-protection',
          targetType: 'specific',
          targetIdentifier: '1-opsgenie-test-team-2',
          targetDisplay: 'opsgenie-test-team-2',
        },
      ],
    });
    render(
      <NotificationActionManager
        updateAlertCount={jest.fn()}
        actions={[notificationActions[3]!]}
        availableActions={availableActions}
        recipientRoles={['owner', 'manager']}
        project={project}
      />
    );

    await userEvent.click(screen.getByTestId('edit-dropdown'));
    await userEvent.click(screen.getByText('Edit'));

    // Edit service
    await userEvent.click(screen.getByTestId('target-display-dropdown'));
    await userEvent.click(screen.getByText('opsgenie-test-team-2'));

    await userEvent.click(screen.getByText('Save'));

    expect(mockPUT).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/notifications/actions/${notificationActions[3]!.id}/`,
      expect.objectContaining({
        data: expect.objectContaining({
          id: 5,
          projects: [project.slug],
          serviceType: 'opsgenie',
          triggerType: 'spike-protection',
          targetType: 'specific',
          integrationId: 3,
          targetIdentifier: '1-opsgenie-test-team-2',
          targetDisplay: 'opsgenie-test-team-2',
        }),
      })
    );
  });
});
