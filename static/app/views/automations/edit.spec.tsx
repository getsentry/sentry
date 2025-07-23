import {AutomationFixture} from 'sentry-fixture/automations';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {useParams} from 'sentry/utils/useParams';
import AutomationDetail from 'sentry/views/automations/detail';
import AutomationEdit from 'sentry/views/automations/edit';

jest.mock('sentry/utils/useParams');

describe('EditAutomationActions', () => {
  const automation = AutomationFixture();
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    // Mock the GET request to fetch automation data
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'GET',
      body: automation,
    });

    // Mock the detectors query (used by ConnectedMonitorsList)
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      method: 'GET',
      body: [],
    });

    // Mock the users query (used for assignee)
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      method: 'GET',
      body: [],
    });

    // Mock data conditions query
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-conditions/`,
      method: 'GET',
      body: [],
    });

    // Mock available actions query
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      method: 'GET',
      body: [],
    });

    // Mock user query
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/${automation.createdBy}/`,
      method: 'GET',
      body: {id: automation.createdBy, name: 'Test User'},
    });

    jest.mocked(useParams).mockReturnValue({
      automationId: automation.id,
    });
  });

  it('calls delete mutation when deletion is confirmed', async () => {
    const mockDeleteAutomation = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'DELETE',
    });

    const {router} = render(<AutomationEdit />, {
      organization,
    });
    renderGlobalModal();

    // Wait for the component to load and display the automation name
    expect(await screen.findByRole('button', {name: 'Delete'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    // Confirm the deletion
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    expect(mockDeleteAutomation).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/workflows/${automation.id}/`,
      expect.anything()
    );

    // Redirect to the monitors list
    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/issues/automations/`
      )
    );
  });

  it('calls update mutation when enabling/disabling automation', async () => {
    const mockUpdateAutomation = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'PUT',
      body: {...automation, enabled: !automation.enabled},
    });

    render(<AutomationDetail />, {
      organization,
    });

    // Wait for the component to load and display automation actions
    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'GET',
      body: {...automation, enabled: !automation.enabled},
    });

    // Click the toggle button to enable/disable the automation
    await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

    // Verify the mutation was called with correct data
    await waitFor(() => {
      expect(mockUpdateAutomation).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/workflows/${automation.id}/`,
        expect.objectContaining({
          data: {...automation, enabled: !automation.enabled},
        })
      );
    });

    // Verify the button text has changed to "Enable"
    expect(await screen.findByRole('button', {name: 'Enable'})).toBeInTheDocument();
  });
});
