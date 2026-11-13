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
  const walletUrl = `/customers/${organization.slug}/seer-wallet/`;

  function mockAutoTopUp(body: Partial<SeerWalletAutoTopUp> = {}) {
    return MockApiClient.addMockResponse({
      url: autoTopUpUrl,
      method: 'GET',
      body: {
        enabled: false,
        thresholdCredits: 500,
        topUpCredits: 1500,
        dailySpendCapCents: null,
        minTopUpCredits: 1500,
        ...body,
      },
    });
  }

  function mockWalletBalance(balance: number) {
    MockApiClient.addMockResponse({
      url: walletUrl,
      method: 'GET',
      body: {
        balance,
        percentUsed: 0,
        included: {total: 500, remaining: Math.min(balance, 500), resetsAt: null},
        purchased: {total: 0, remaining: Math.max(balance - 500, 0), expiresAt: null},
        creditPriceCents: 1,
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
    // Above the 500-credit threshold, so turning auto-reload on bills nothing yet.
    mockWalletBalance(1200);
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

  it('keeps no daily usage limit from the saved settings', async () => {
    mockAutoTopUp({enabled: true, topUpCredits: 5000, dailySpendCapCents: null});
    renderCheckout();

    expect(await screen.findByLabelText('Daily usage limit')).toHaveValue('');
    expect(screen.getByPlaceholderText('No limit')).toBeInTheDocument();
  });

  it.each([
    ['saved settings', autoTopUpUrl],
    ['balance', walletUrl],
  ])('does not offer auto-reload when its %s fail to load', async (_, url) => {
    mockAutoTopUp();
    MockApiClient.addMockResponse({url, method: 'GET', statusCode: 500});
    renderCheckout();

    expect(
      await screen.findByText("We couldn't load your auto-reload settings.")
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', {name: 'Auto-reload'})).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-item-seer')).toHaveTextContent(
      'Included credits$5/mo'
    );
  });

  it('blocks checkout until the reload amount meets the minimum', async () => {
    mockAutoTopUp({minTopUpCredits: 2000});
    renderCheckout();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'Auto-reload'}));
    const reloadAmount = screen.getByLabelText('Reload amount');
    await userEvent.clear(reloadAmount);
    await userEvent.type(reloadAmount, '10');

    expect(screen.getByText('Must be at least $20.')).toBeInTheDocument();
    expect(reloadAmount).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByRole('button', {name: 'Confirm and pay'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await userEvent.type(reloadAmount, '0');
    expect(screen.queryByText('Must be at least $20.')).not.toBeInTheDocument();

    // A $0 daily usage limit is allowed, with a warning.
    const dailyLimit = screen.getByLabelText('Daily usage limit');
    await userEvent.clear(dailyLimit);
    await userEvent.type(dailyLimit, '0');
    expect(screen.getByText('A $0 limit turns off all Seer usage.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm and pay'})).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('shows the first reload charged today when the balance is at the threshold', async () => {
    mockAutoTopUp();
    mockWalletBalance(500);
    renderCheckout();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'Auto-reload'}));

    expect(
      await screen.findByTestId('summary-item-seer-auto-reload-charge')
    ).toHaveTextContent('Seer auto-reload, charged today$25 + tax');
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
    // An empty daily usage limit means no limit.
    await userEvent.clear(screen.getByLabelText('Daily usage limit'));
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm and pay'}));

    await waitFor(() =>
      expect(autoTopUpRequest).toHaveBeenCalledWith(
        autoTopUpUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {enabled: true, topUpCredits: 2500, dailySpendCapCents: null},
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
    // Auto-reload is already on, so a low balance isn't billed by checkout.
    mockWalletBalance(0);
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
    expect(
      screen.queryByTestId('summary-item-seer-auto-reload-charge')
    ).not.toBeInTheDocument();
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
