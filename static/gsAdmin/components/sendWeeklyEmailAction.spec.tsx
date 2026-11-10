import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {toast} from '@sentry/scraps/toast';

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

  afterEach(() => {
    MockApiClient.asyncDelay = undefined;
  });

  it('shows a success message after the modal closes when the request succeeds', async () => {
    const successMessage = jest.spyOn(toast, 'success');
    const sendMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {},
      asyncDelay: 1,
    });

    openModal();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Dry Run'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(successMessage).toHaveBeenCalledWith('Email queued');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sendMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        data: {targetEmail: '', deliveryEmail: '', dryRun: true},
      })
    );
  });

  it('sends the entered emails when dry run is disabled', async () => {
    const sendMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {},
    });

    openModal();
    const [targetInput, deliveryInput] = screen.getAllByRole('textbox');
    await userEvent.type(targetInput!, 'target@example.com');
    await userEvent.type(deliveryInput!, 'delivery@example.com');
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: {
            targetEmail: 'target@example.com',
            deliveryEmail: 'delivery@example.com',
            dryRun: false,
          },
        })
      );
    });
  });

  it('shows a membership error after the modal closes when the request returns 404', async () => {
    MockApiClient.asyncDelay = 1;
    const errorMessage = jest.spyOn(toast, 'error');
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 404,
      body: {},
    });

    openModal();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Dry Run'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(errorMessage).toHaveBeenCalledWith(
        'User is not a member of the organization!'
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the response text after the modal closes when the request fails with another status', async () => {
    MockApiClient.asyncDelay = 1;
    const errorMessage = jest.spyOn(toast, 'error');
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Report generation failed'},
    });

    openModal();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Dry Run'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(errorMessage).toHaveBeenCalledWith('{"detail":"Report generation failed"}');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a validation error without sending when the delivery email is missing', async () => {
    const errorMessage = jest.spyOn(toast, 'error');
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
