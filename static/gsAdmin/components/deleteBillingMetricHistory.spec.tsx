import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {Organization} from 'sentry/types/organization';

import deleteBillingMetricHistory from 'admin/components/deleteBillingMetricHistory';

describe('DeleteBillingMetricHistory', () => {
  // Add afterEach to clean up after tests
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  const organization = OrganizationFixture({
    features: ['delete-billing-metric-history-admin'],
  });

  const openDeleteModal = (
    props: {organization: Organization; onSuccess?: () => void} = {organization}
  ) => {
    deleteBillingMetricHistory({
      organization,
      onSuccess: props.onSuccess || jest.fn(),
    });
    renderGlobalModal();
  };

  it('renders modal with billing config data', async () => {
    // Mock the billing config API call
    const billingConfigMock = MockApiClient.addMockResponse({
      url: '/api/0/billing-config/',
      body: {
        category_info: {
          '1': {
            api_name: 'errors',
            billed_category: 1,
            display_name: 'Errors',
            name: 'errors',
            order: 1,
            product_name: 'Error Tracking',
            singular: 'error',
            tally_type: 1,
          },
          '2': {
            api_name: 'transactions',
            billed_category: 2,
            display_name: 'Transactions',
            name: 'transactions',
            order: 2,
            product_name: 'Performance',
            singular: 'transaction',
            tally_type: 2,
          },
        },
        outcomes: {
          '0': 'Accepted',
          '1': 'Filtered',
          '2': 'Rate Limited',
        },
        reason_codes: {
          '0': 'Default',
          '1': 'Quota',
          '2': 'Rate Limit',
        },
      },
    });

    openDeleteModal();

    // Check that the billing config API was called
    expect(billingConfigMock).toHaveBeenCalled();

    // Check that the modal is rendered with the correct title
    expect(screen.getByText('Delete Billing Metric History')).toBeInTheDocument();

    // Wait for the loading indicator to disappear and for content to appear
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Check for the description text
    await waitFor(() => {
      expect(
        screen.getByText('Delete billing metric history for a specific data category.')
      ).toBeInTheDocument();
    });

    // Check that the form elements are rendered
    expect(screen.getByRole('textbox', {name: 'Data Category'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('successfully deletes billing metric history when form is submitted', async () => {
    // Mock the billing config API call
    MockApiClient.addMockResponse({
      url: '/api/0/billing-config/',
      body: {
        category_info: {
          '1': {
            api_name: 'errors',
            billed_category: 1,
            display_name: 'Errors',
            name: 'errors',
            order: 1,
            product_name: 'Error Tracking',
            singular: 'error',
            tally_type: 1,
          },
          '2': {
            api_name: 'transactions',
            billed_category: 2,
            display_name: 'Transactions',
            name: 'transactions',
            order: 2,
            product_name: 'Performance',
            singular: 'transaction',
            tally_type: 2,
          },
        },
        outcomes: {},
        reason_codes: {},
      },
    });

    // Mock the success indicator
    const successIndicator = jest.spyOn(
      require('sentry/actionCreators/indicator'),
      'addSuccessMessage'
    );

    // Mock the API endpoint for deleting billing metric history
    const deleteBillingMetricHistoryMock = MockApiClient.addMockResponse({
      url: `/api/0/customers/${organization.slug}/delete-billing-metric-history/`,
      method: 'POST',
      body: {},
    });

    const onSuccess = jest.fn();
    openDeleteModal({organization, onSuccess});

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Wait for the form to be visible
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Data Category'})).toBeInTheDocument();
    });

    // Select a data category
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Data Category'}),
      'Transactions (2)'
    );

    // Click the Delete button
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    // Check that the API call was made with the correct parameters
    expect(deleteBillingMetricHistoryMock).toHaveBeenCalledWith(
      `/api/0/customers/${organization.slug}/delete-billing-metric-history/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          data_category: 2,
        },
      })
    );

    // Check that the success message was shown
    expect(successIndicator).toHaveBeenCalledWith(
      'Successfully deleted billing metric history.'
    );

    // Check that the onSuccess callback was called
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error message when API request fails', async () => {
    // Mock the billing config API call
    MockApiClient.addMockResponse({
      url: '/api/0/billing-config/',
      body: {
        category_info: {
          '1': {
            api_name: 'errors',
            billed_category: 1,
            display_name: 'Errors',
            name: 'errors',
            order: 1,
            product_name: 'Error Tracking',
            singular: 'error',
            tally_type: 1,
          },
        },
        outcomes: {},
        reason_codes: {},
      },
    });

    // Mock the error indicator
    const errorIndicator = jest.spyOn(
      require('sentry/actionCreators/indicator'),
      'addErrorMessage'
    );

    // Mock the API endpoint to return an error
    const deleteBillingMetricHistoryMock = MockApiClient.addMockResponse({
      url: `/api/0/customers/${organization.slug}/delete-billing-metric-history/`,
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'An error occurred while deleting billing metric history.',
      },
    });

    openDeleteModal();

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Wait for the form to be visible
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Data Category'})).toBeInTheDocument();
    });

    // Select a data category
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Data Category'}),
      'Errors (1)'
    );

    // Click the Delete button
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    // Check that the API call was made
    expect(deleteBillingMetricHistoryMock).toHaveBeenCalled();

    // Check that the error message was shown
    await waitFor(() => {
      expect(errorIndicator).toHaveBeenCalledWith(
        'An error occurred while deleting billing metric history.'
      );
    });
  });

  it('disables Submit button when no data category is selected', async () => {
    // Mock the billing config API call
    MockApiClient.addMockResponse({
      url: '/api/0/billing-config/',
      body: {
        category_info: {
          '1': {
            api_name: 'errors',
            billed_category: 1,
            display_name: 'Errors',
            name: 'errors',
            order: 1,
            product_name: 'Error Tracking',
            singular: 'error',
            tally_type: 1,
          },
        },
        outcomes: {},
        reason_codes: {},
      },
    });

    openDeleteModal();

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Wait for the form to be visible
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Data Category'})).toBeInTheDocument();
    });

    // Check that the Delete button is disabled when no data category is selected
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();

    // Select a data category
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Data Category'}),
      'Errors (1)'
    );

    // Now the Delete button should be enabled
    expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled();
  });

  it('closes modal when Cancel button is clicked', async () => {
    // Mock the billing config API call
    MockApiClient.addMockResponse({
      url: '/api/0/billing-config/',
      body: {
        category_info: {
          '1': {
            api_name: 'errors',
            billed_category: 1,
            display_name: 'Errors',
            name: 'errors',
            order: 1,
            product_name: 'Error Tracking',
            singular: 'error',
            tally_type: 1,
          },
        },
        outcomes: {},
        reason_codes: {},
      },
    });

    openDeleteModal();

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Check that the modal is rendered with the correct title
    expect(screen.getByText('Delete Billing Metric History')).toBeInTheDocument();

    // Wait for the form to be visible
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Data Category'})).toBeInTheDocument();
    });

    // Click the Cancel button
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    // Check that the modal is closed
    expect(screen.queryByText('Delete Billing Metric History')).not.toBeInTheDocument();
  });
});

describe('deleteBillingMetricHistory export function', () => {
  it('opens modal with correct props', () => {
    const organization = OrganizationFixture();
    const onSuccess = jest.fn();
    const openModalMock = jest.spyOn(require('sentry/actionCreators/modal'), 'openModal');

    deleteBillingMetricHistory({organization, onSuccess});

    expect(openModalMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        closeEvents: 'escape-key',
      })
    );
  });
});
