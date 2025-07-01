import {DetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {EditDetectorActions} from './editDetectorActions';

describe('EditDetectorActions', () => {
  it('calls delete mutation when deletion is confirmed', async () => {
    const detector = DetectorFixture();
    const organization = OrganizationFixture();

    const mockDeleteDetector = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      method: 'DELETE',
    });

    const {router} = render(<EditDetectorActions detectorId={detector.id} />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    // Confirm the deletion
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    expect(mockDeleteDetector).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/detectors/${detector.id}/`,
      expect.anything()
    );

    // Redirect to the monitors list
    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/issues/monitors/`
    );
  });
});
