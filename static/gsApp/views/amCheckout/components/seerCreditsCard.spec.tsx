import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {InvoicePreviewFixture} from 'getsentry-test/fixtures/invoicePreview';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {PlanTier} from 'getsentry-test/planTier';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {AddOnCategory} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import type {SeerWalletAutoTopUp} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

describe('SeerCreditsCard', () => {
  const organization = OrganizationFixture({
    features: ['seer-billing', 'token-billed-seer-enabled'],
  });
  const autoTopUpUrl = `/customers/${organization.slug}/seer-wallet/auto-top-up/`;

  function mockAutoTopUp(body: Partial<SeerWalletAutoTopUp> = {}) {
    return MockApiClient.addMockResponse({
      url: autoTopUpUrl,
      method: 'GET',
      body: {
        enabled: false,
        thresholdCredits: 500,
        topUpCredits: 1000,
        dailySpendCapCents: 7500,
        ...body,
      },
    });
  }

  function renderCheckout() {
    render(<AMCheckout {...RouteComponentPropsFixture()} navigate={jest.fn()} />, {
      organization,
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, plan: 'am3_team'})
    );

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: InvoicePreviewFixture({billedAmount: 89_00}),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/`,
      method: 'GET',
      body: {},
    });
  });

  it('shows included credits in place of the Seer add-ons', async () => {
    mockAutoTopUp();
    renderCheckout();

    const card = await screen.findByTestId('seer-credits');
    expect(card).toHaveTextContent('$5 in credits');
    expect(card).toHaveTextContent('Included every month');
    expect(await screen.findByRole('checkbox', {name: 'Auto-reload'})).not.toBeChecked();
    expect(screen.queryByLabelText('Reload amount')).not.toBeInTheDocument();

    expect(
      screen.queryByTestId(`product-option-${AddOnCategory.SEER}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`product-option-${AddOnCategory.LEGACY_SEER}`)
    ).not.toBeInTheDocument();

    expect(screen.getByTestId('summary-item-seer')).toHaveTextContent(
      'Included credits$5/mo'
    );
    expect(
      screen.getByTestId('summary-item-due-today').parentElement
    ).not.toHaveTextContent('billed separately');
  });

  it('shows the auto-reload amounts and their cost once turned on', async () => {
    mockAutoTopUp();
    renderCheckout();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'Auto-reload'}));

    const card = screen.getByTestId('seer-credits');
    expect(within(card).getByLabelText('Reload amount')).toHaveValue('25');
    expect(within(card).getByText('2,500 credits')).toBeInTheDocument();
    expect(within(card).getByLabelText('Daily usage limit')).toHaveValue('100');
    expect(within(card).getByText('10,000 credits')).toBeInTheDocument();

    const seerSummary = screen.getByTestId('summary-item-seer');
    expect(seerSummary).toHaveTextContent('$5/mo creditFree');
    expect(seerSummary).toHaveTextContent('2,500 credits$25');
    expect(screen.getByTestId('summary-item-due-today').parentElement).toHaveTextContent(
      'Business plan and Seer auto-reload are billed separately'
    );
  });

  it('starts from the saved auto-reload settings', async () => {
    mockAutoTopUp({enabled: true, topUpCredits: 5000, dailySpendCapCents: 20_00});
    renderCheckout();

    expect(await screen.findByRole('checkbox', {name: 'Auto-reload'})).toBeChecked();
    expect(screen.getByLabelText('Reload amount')).toHaveValue('50');
    expect(screen.getByLabelText('Daily usage limit')).toHaveValue('20');
  });

  it('does not offer auto-reload when its saved settings fail to load', async () => {
    MockApiClient.addMockResponse({url: autoTopUpUrl, method: 'GET', statusCode: 500});
    renderCheckout();

    expect(
      await screen.findByText("We couldn't load your auto-reload settings.")
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', {name: 'Auto-reload'})).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-item-seer')).toHaveTextContent(
      'Included credits$5/mo'
    );
  });

  it('blocks checkout until the auto-reload amounts are valid', async () => {
    mockAutoTopUp();
    renderCheckout();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'Auto-reload'}));
    const reloadAmount = screen.getByLabelText('Reload amount');
    await userEvent.clear(reloadAmount);
    await userEvent.type(reloadAmount, '10');

    expect(screen.getByText('Must be at least $15.')).toBeInTheDocument();
    expect(reloadAmount).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByRole('button', {name: 'Confirm and pay'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await userEvent.type(reloadAmount, '0');
    expect(screen.queryByText('Must be at least $15.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm and pay'})).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('saves auto-reload after the plan change goes through', async () => {
    mockAutoTopUp();
    const checkoutRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      body: {},
    });
    const autoTopUpRequest = MockApiClient.addMockResponse({
      url: autoTopUpUrl,
      method: 'PUT',
      body: {},
    });
    renderCheckout();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'Auto-reload'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm and pay'}));

    await waitFor(() =>
      expect(autoTopUpRequest).toHaveBeenCalledWith(
        autoTopUpUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {enabled: true, topUpCredits: 2500, dailySpendCapCents: 100_00},
        })
      )
    );
    // Auto-reload isn't part of the subscription.
    expect(checkoutRequest).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/`,
      expect.objectContaining({
        data: expect.not.objectContaining({seerAutoReload: expect.anything()}),
      })
    );
  });

  it('leaves auto-reload alone when it was not changed', async () => {
    mockAutoTopUp({enabled: true, topUpCredits: 5000, dailySpendCapCents: 20_00});
    const checkoutRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      body: {},
    });
    const autoTopUpRequest = MockApiClient.addMockResponse({
      url: autoTopUpUrl,
      method: 'PUT',
      body: {},
    });
    renderCheckout();

    expect(await screen.findByRole('checkbox', {name: 'Auto-reload'})).toBeChecked();
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm and pay'}));

    await waitFor(() => expect(checkoutRequest).toHaveBeenCalled());
    expect(await screen.findByText(/Consider it done/)).toBeInTheDocument();
    expect(autoTopUpRequest).not.toHaveBeenCalled();
  });

  it('does not show for organizations not billed on Seer credits', async () => {
    const seatBasedOrganization = OrganizationFixture({features: ['seer-billing']});
    SubscriptionStore.set(
      seatBasedOrganization.slug,
      SubscriptionFixture({organization: seatBasedOrganization, plan: 'am3_team'})
    );
    render(<AMCheckout {...RouteComponentPropsFixture()} navigate={jest.fn()} />, {
      organization: seatBasedOrganization,
    });

    expect(
      await screen.findByTestId(`product-option-${AddOnCategory.SEER}`)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('seer-credits')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-item-seer')).not.toBeInTheDocument();
  });
});
