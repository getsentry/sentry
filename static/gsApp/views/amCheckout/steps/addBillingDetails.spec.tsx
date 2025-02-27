import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {AddressType, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import AddBillingDetails from 'getsentry/views/amCheckout/steps/addBillingDetails';
import type {StepProps} from 'getsentry/views/amCheckout/types';

jest.mock('getsentry/utils/stripe', () => {
  return {
    loadStripe: (cb: any) => {
      if (!cb) {
        return;
      }
      cb(() => {
        return {
          elements: jest.fn(() => ({
            create: jest.fn(() => ({
              mount: jest.fn(),
              on(_name: any, handler: any) {
                handler();
              },
              update: jest.fn(),
            })),
          })),
        };
      });
    },
  };
});

describe('Billing Details Step', function () {
  const api = new MockApiClient();

  const {organization, router, routerProps} = initializeOrg({
    organization: {
      access: ['org:billing'] as any, // TODO(ts): Fix this type for organizations on a plan
    },
  });

  const subscription = SubscriptionFixture({organization});
  const params = {};

  const billingDetails = BillingDetailsFixture({addressType: null});
  const stepNumber = 6;
  const billingConfig = BillingConfigFixture(PlanTier.AM1);

  const stepProps: StepProps = {
    isActive: true,
    stepNumber,
    onUpdate: jest.fn(),
    onCompleteStep: jest.fn(),
    onEdit: jest.fn(),
    billingConfig,
    formData: {
      plan: billingConfig.defaultPlan,
      reserved: {},
    },
    activePlan: PlanDetailsLookupFixture('am1_business')!,
    subscription,
    organization,
    isCompleted: false,
    prevStepCompleted: false,
  };
  let updateMock: any;

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: subscription,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {},
    });
    updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'PUT',
    });
  });

  const completeForm = async (formInput: any) => {
    await userEvent.type(
      screen.getByRole('textbox', {name: /street address 1/i}),
      formInput.addressLine1
    );
    await userEvent.type(screen.getByRole('textbox', {name: /city/i}), formInput.city);
    await userEvent.type(
      screen.getByRole('textbox', {name: /postal code/i}),
      formInput.postalCode
    );
  };

  it('cannot skip to step', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
        params={params}
      />,
      {router}
    );

    await screen.findByTestId('checkout-steps');

    expect(
      screen.queryByRole('textbox', {name: /street address 1/i})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Billing Details'));

    await screen.findByTestId('checkout-steps');
    expect(
      screen.queryByRole('textbox', {name: /street address 1/i})
    ).not.toBeInTheDocument();
  });

  it('renders without existing billing address', async function () {
    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    expect(screen.getByRole('textbox', {name: /street address 2/i})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /city/i})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /state \/ region/i})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /postal code/i})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /company name/i})).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: /billing email/i})
    ).not.toBeInTheDocument();
  });

  it('renders billing address', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: billingDetails,
    });

    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    expect(screen.getByDisplayValue('123 Street')).toBeInTheDocument();
    expect(screen.getByDisplayValue('San Francisco')).toBeInTheDocument();
    expect(screen.getByText('California')).toBeInTheDocument();
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12345')).toBeInTheDocument();

    expect(screen.getByText(/current billing details on file/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /edit details/i})).not.toBeInTheDocument();

    // tax number field not included
    expect(screen.queryByRole('textbox', {name: /vat number/i})).not.toBeInTheDocument();
  });

  it('can complete step', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {countryCode: billingDetails.countryCode, region: billingDetails.region},
    });

    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    // Add form data
    await completeForm(billingDetails);
    expect(screen.queryByRole('textbox', {name: /vat number/i})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /cancel/i})).not.toBeInTheDocument();

    // Submit form
    await userEvent.click(screen.getByRole('button', {name: /continue/i}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-details/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          addressLine1: billingDetails.addressLine1,
          city: billingDetails.city,
          countryCode: billingDetails.countryCode,
          postalCode: billingDetails.postalCode,
          region: billingDetails.region,
          taxNumber: billingDetails.taxNumber,
        },
      })
    );
  });

  it('renders tax number and region for EU country', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {
        ...billingDetails,
        region: 'Vienna',
        countryCode: 'AT', // Austria
        taxNumber: 'U12345678',
      },
    });

    render(
      <AddBillingDetails
        {...stepProps}
        subscription={subscription}
        isCompleted={false}
        prevStepCompleted
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /vat number/i});
    expect(screen.getByDisplayValue('U12345678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Vienna')).toBeInTheDocument();
  });

  it('renders tax number field for GST country', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {
        ...billingDetails,
        countryCode: 'CA', // Canada
        region: 'ON',
      },
    });

    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /gst\/hst number/i});
  });

  it('can submit VAT number', async function () {
    const details = {
      addressLine1: 'Rothschildplatz 3/3.02.AB',
      addressLine2: '1020 Wien',
      city: 'Vienna',
      region: 'Vienna',
      countryCode: 'AT',
      postalCode: '69FV+78',
      taxNumber: 'U12345678',
    };

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {countryCode: details.countryCode, region: details.region},
    });

    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /vat number/i});
    // Add form data
    await completeForm(details);
    await userEvent.type(
      screen.getByRole('textbox', {name: /vat number/i}),
      details.taxNumber
    );

    // Submit form
    await userEvent.click(screen.getByRole('button', {name: /continue/i}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-details/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          addressLine1: details.addressLine1,
          city: details.city,
          countryCode: details.countryCode,
          postalCode: details.postalCode,
          region: details.region,
          taxNumber: details.taxNumber,
        },
      })
    );
  });

  it('can clear VAT number for non-VAT country', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {...billingDetails, taxNumber: 'U12345678'},
    });

    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    await userEvent.clear(screen.getByRole('textbox', {name: /street address 1/i}));
    await userEvent.type(
      screen.getByRole('textbox', {name: /street address 1/i}),
      'Test Street'
    );

    // Submit form
    await userEvent.click(screen.getByRole('button', {name: /continue/i}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-details/`,
      expect.objectContaining({
        method: 'PUT',
        data: {...billingDetails, addressLine1: 'Test Street'},
      })
    );
  });

  it('displays tax id for country without sales tax if it exists', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {...billingDetails, taxNumber: '123456789'},
    });

    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    expect(screen.getByRole('textbox', {name: /tax number/i})).toBeInTheDocument();
    expect(screen.getByDisplayValue('123456789')).toBeInTheDocument();
  });

  it('displays address on file', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {
        ...billingDetails,
        taxNumber: '123456789',
        addressType: AddressType.STRUCTURED,
      },
    });

    const onCompleteStep = jest.fn();
    const props = {...stepProps, onCompleteStep};
    render(
      <AddBillingDetails
        {...props}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByText(/current billing details on file/i);
    expect(screen.getByRole('button', {name: /edit details/i})).toBeInTheDocument();

    expect(screen.getByText(`${billingDetails.addressLine1}`)).toBeInTheDocument();
    expect(screen.getByText(`${billingDetails.city}`)).toBeInTheDocument();
    expect(screen.getByText(/united states/i)).toBeInTheDocument();
    expect(screen.getByText(`${billingDetails.postalCode}`)).toBeInTheDocument();
    expect(screen.getByText(/california/i)).toBeInTheDocument();
    expect(screen.getByText('123456789')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /continue/i}));
    expect(onCompleteStep).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('can edit address on file', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {
        ...billingDetails,
        addressType: AddressType.STRUCTURED,
      },
    });

    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByText(/current billing details on file/i);
    await userEvent.click(screen.getByRole('button', {name: /edit details/i}));

    await screen.findByRole('textbox', {name: /street address 1/i});
    expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('textbox', {name: /street address 2/i}),
      '3rd Floor'
    );

    await userEvent.click(screen.getByRole('button', {name: /continue/i}));
    expect(updateMock).toHaveBeenCalled();
  });

  it('handles invalid region choice', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {
        ...billingDetails,
        region: 'invalid',
      },
    });

    render(
      <AddBillingDetails
        {...stepProps}
        isCompleted={false}
        prevStepCompleted
        subscription={subscription}
      />,
      {router}
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    await userEvent.type(
      screen.getByRole('textbox', {name: /street address 1/i}),
      '{selectall}{backspace}Test Street'
    );

    expect(screen.queryByText('invalid')).not.toBeInTheDocument();
    expect(screen.queryByText(/Field is required/i)).not.toBeInTheDocument();

    // Submit form
    const submitButton = screen.getByRole('button', {name: /continue/i});
    expect(submitButton).toBeDisabled();
    await userEvent.hover(submitButton);
    expect(
      await screen.findByText('Required fields must be filled out')
    ).toBeInTheDocument();

    // Try to submit form
    await userEvent.click(submitButton);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
