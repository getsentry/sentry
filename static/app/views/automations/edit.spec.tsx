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

import {trackAnalytics} from 'sentry/utils/analytics';
import {useParams} from 'sentry/utils/useParams';
import AutomationEdit from 'sentry/views/automations/edit';

jest.mock('sentry/utils/useParams');
jest.mock('sentry/utils/analytics');

describe('EditAutomation', () => {
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

    // Mock the organization tags
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      method: 'GET',
      body: [],
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
        `/organizations/${organization.slug}/monitors/alerts/`
      )
    );
  });

  it('calls update mutation when enabling/disabling automation', async () => {
    const mockUpdateAutomation = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'PUT',
      body: {...automation, enabled: !automation.enabled},
    });

    render(<AutomationEdit />, {
      organization,
    });

    // Wait for the component to load and display automation actions
    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();

    // Click the toggle button to enable/disable the automation
    await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

    // Verify the mutation was called with correct data
    await waitFor(() => {
      expect(mockUpdateAutomation).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/workflows/${automation.id}/`,
        expect.objectContaining({
          data: {id: automation.id, name: automation.name, enabled: !automation.enabled},
        })
      );
    });

    // Verify the button text has changed to "Enable"
    expect(await screen.findByRole('button', {name: 'Enable'})).toBeInTheDocument();
  });

  it('updates automation', async () => {
    const mockUpdateAutomation = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'PUT',
      body: automation,
    });

    const {router} = render(<AutomationEdit />, {
      organization,
    });

    expect(await screen.findAllByText(/Automation 1/i)).toHaveLength(2);

    // Update an existing filter value field
    const valueInput = screen.getByRole('textbox', {name: 'Value'});
    await userEvent.clear(valueInput);
    await userEvent.type(valueInput, 'updated value');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(mockUpdateAutomation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            actionFilters: expect.arrayContaining([
              expect.objectContaining({
                conditions: expect.arrayContaining([
                  expect.objectContaining({
                    comparison: expect.objectContaining({
                      value: 'updated value',
                    }),
                  }),
                ]),
              }),
            ]),
          }),
        })
      );
    });

    expect(trackAnalytics).toHaveBeenCalledWith('automation.updated', {
      organization,
      frequency_minutes: 1440,
      environment: 'production',
      detectors_count: 1,
      trigger_conditions_count: 0,
      actions_count: 1,
    });

    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/monitors/alerts/${automation.id}/`
      )
    );
  });
});
