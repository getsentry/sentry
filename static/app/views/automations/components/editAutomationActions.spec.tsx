import {AutomationFixture} from 'sentry-fixture/automations';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {EditAutomationActions} from './editAutomationActions';

describe('EditDetectorActions', () => {
  it('calls delete mutation when deletion is confirmed', async () => {
    const automation = AutomationFixture();
    const organization = OrganizationFixture();

    const mockDeleteDetector = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'DELETE',
    });

    const {router} = render(<EditAutomationActions automation={automation} />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    // Confirm the deletion
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    expect(mockDeleteDetector).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/workflows/${automation.id}/`,
      expect.anything()
    );

    // Redirect to the monitors list
    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/issues/automations/`
    );
  });

  it('calls update mutation when disable is selected', async () => {
    const automation = AutomationFixture();
    const organization = OrganizationFixture();

    const mockUpdateDetector = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/${automation.id}/`,
      method: 'PUT',
    });

    render(<EditAutomationActions automation={automation} />);

    await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

    expect(mockUpdateDetector).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/workflows/${automation.id}/`,
      expect.anything()
    );
  });
});
