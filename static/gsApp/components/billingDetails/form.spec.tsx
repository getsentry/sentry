import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import BillingDetailsForm from './form';

describe('BillingDetailsForm', () => {
  const organization = OrganizationFixture({access: ['org:billing']});
  const billingDetails = BillingDetailsFixture();
  const defaultProps = {
    organization,
    onSubmitSuccess: jest.fn(),
    initialData: billingDetails,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('returns null for users without org:billing access', () => {
    const orgWithoutAccess = OrganizationFixture({access: []});
    const {container} = render(
      <BillingDetailsForm {...defaultProps} organization={orgWithoutAccess} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('hides loading indicator when Stripe loads', async () => {
    render(<BillingDetailsForm {...defaultProps} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('shows billing email field when isDetailed is true', async () => {
    render(<BillingDetailsForm {...defaultProps} isDetailed />);

    await screen.findByRole('textbox', {name: 'Billing email'});
  });

  it('hides billing email field when isDetailed is false', async () => {
    render(<BillingDetailsForm {...defaultProps} isDetailed={false} />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole('textbox', {name: 'Billing email'})
    ).not.toBeInTheDocument();
  });

  it('shows warning when Stripe hooks return null', async () => {
    const stripeImport = await import('@stripe/react-stripe-js');
    jest.spyOn(stripeImport, 'useStripe').mockReturnValue(null as any);
    jest.spyOn(stripeImport, 'useElements').mockReturnValue(null as any);

    render(<BillingDetailsForm {...defaultProps} />);

    await waitFor(
      () => {
        expect(
          screen.getByText(
            /To add or update your business address, you may need to disable any ad or tracker blocking extensions/
          )
        ).toBeInTheDocument();
      },
      {timeout: 11000} // the timeout in the code is 10 seconds so we need to wait longer
    );

    jest.restoreAllMocks();
  }, 15000);

  it('disables submit button during loading', async () => {
    render(<BillingDetailsForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', {name: 'Save Changes'});
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    expect(submitButton).toBeEnabled();
  });

  it('shows tax number field when country has sales tax', async () => {
    const detailsWithTax = BillingDetailsFixture({
      countryCode: 'GB',
      taxNumber: '123456789',
    });

    render(
      <BillingDetailsForm {...defaultProps} initialData={detailsWithTax} isDetailed />
    );

    await screen.findByRole('textbox', {name: /VAT Number/i});
  });

  it('renders custom submit label when provided', async () => {
    render(<BillingDetailsForm {...defaultProps} submitLabel="Update Address" />);

    await screen.findByRole('button', {name: 'Update Address'});
  });

  it('renders extra button when provided', async () => {
    const extraButton = <button type="button">Extra Action</button>;
    render(<BillingDetailsForm {...defaultProps} extraButton={extraButton} />);

    await screen.findByRole('button', {name: 'Extra Action'});
  });
});
