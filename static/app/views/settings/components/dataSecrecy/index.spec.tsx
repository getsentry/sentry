import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as indicatorActions from 'sentry/actionCreators/indicator';
import {DataSecrecy} from 'sentry/views/settings/components/dataSecrecy';

jest.mock('sentry/actionCreators/indicator');

describe('DataSecrecy', function () {
  const {organization} = initializeOrg();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders default state with no waiver', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: null,
    });

    render(<DataSecrecy />, {organization: organization});

    await waitFor(() => {
      expect(screen.getByText('Data Secrecy Waiver')).toBeInTheDocument();
      expect(
        screen.getByText('Data secrecy is not currently waived')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Add Waiver'})).toBeInTheDocument();
    });
  });

  it('renders current waiver state', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: {
        access_start: '2023-08-01T00:00:00Z',
        access_end: '2024-08-01T00:00:00Z',
      },
    });

    render(<DataSecrecy />, {organization: organization});

    await waitFor(() => {
      expect(screen.getByText(/Data secrecy will be waived from/)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Edit'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Remove Waiver'})).toBeInTheDocument();
    });
  });

  it('opens edit form when Edit button is clicked', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: {
        access_start: '2023-08-01T00:00:00Z',
        access_end: '2024-08-01T00:00:00Z',
      },
    });

    render(<DataSecrecy />, {organization: organization});

    const editButton = await screen.findByRole('button', {name: 'Edit'});
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(/waiver start time/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/2023\-08\-01t00:00/i)).toBeInTheDocument();
      expect(screen.getByText(/waiver end time/i)).toBeInTheDocument();
    });
  });

  it('submits form successfully', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: null,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      method: 'PUT',
      statusCode: 200,
    });

    render(<DataSecrecy />, {organization: organization});

    const addWaiverButton = await screen.findByRole('button', {name: 'Add Waiver'});
    await userEvent.click(addWaiverButton);

    await userEvent.type(await screen.getByText(/waiver end time/i), '2025-08-01T00:00');

    const saveButton = await screen.findByRole('button', {name: 'Save Changes'});
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(indicatorActions.addSuccessMessage).toHaveBeenCalledWith(
        'Successfully updated data secrecy waiver'
      );
    });
  });

  it('removes waiver successfully', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: {
        access_start: '2023-08-01T00:00:00Z',
        access_end: '2024-08-01T00:00:00Z',
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      method: 'DELETE',
      statusCode: 204,
    });

    render(<DataSecrecy />, {organization: organization});

    await waitFor(() => {
      expect(screen.getByText('Data Secrecy Waiver')).toBeInTheDocument();
    });

    const removeWaiverButton = await screen.getByRole('button', {name: /remove waiver/i});
    await userEvent.click(removeWaiverButton);
    renderGlobalModal();

    const confirmButton = await screen.findByRole('button', {name: 'Confirm'});

    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(indicatorActions.addSuccessMessage).toHaveBeenCalledWith(
        'Successfully removed data secrecy waiver'
      );
    });
  });
});
