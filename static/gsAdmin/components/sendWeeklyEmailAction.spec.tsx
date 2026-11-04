import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';

import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import {SendWeeklyEmailAction} from 'admin/components/sendWeeklyEmailAction';

describe('SendWeeklyEmailAction', () => {
  const organization = OrganizationFixture();
  const endpoint = `/customers/${organization.slug}/send-weekly-email/`;

  function openModal() {
    openAdminConfirmModal({
      showAuditFields: false,
      renderModalSpecificContent: deps => (
        <SendWeeklyEmailAction orgId={organization.slug} {...deps} />
      ),
    });
    renderGlobalModal();
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('shows a success message after confirming when the request succeeds', async () => {
    const successMessage = jest.spyOn(indicators, 'addSuccessMessage');
    const sendMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {},
    });

    openModal();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Dry Run'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(successMessage).toHaveBeenCalledWith('Email queued');
    });
    expect(sendMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        data: {targetEmail: '', deliveryEmail: '', dryRun: true},
      })
    );
  });

  it('shows a validation error without sending when the delivery email is missing', async () => {
    const errorMessage = jest.spyOn(indicators, 'addErrorMessage');
    const sendMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {},
    });

    openModal();
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(errorMessage).toHaveBeenCalledWith(
      'Delivery email address is required when dry run is disabled'
    );
    expect(sendMock).not.toHaveBeenCalled();
  });
});
