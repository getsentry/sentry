import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';

import {SeerCreditUsageMeter} from './seerCreditUsageMeter';

const billingOrganization = OrganizationFixture({
  access: ['org:read', 'org:billing'],
  features: ['seer-credit-checks', 'token-billed-seer-enabled'],
});

function mockWallet(
  organization: Organization,
  {
    autoReload = false,
    balance = 250,
    percentUsed = 0.75,
    included = 1000,
    purchased = 0,
  }: {
    autoReload?: boolean;
    balance?: number;
    included?: number;
    percentUsed?: number;
    purchased?: number;
  } = {}
) {
  const wallet = MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/seer-wallet/`,
    body: {
      balance,
      percentUsed,
      included: {remaining: balance, resetsAt: null, total: included},
      purchased: {remaining: 0, expiresAt: null, total: purchased},
      creditPriceCents: 1,
    },
  });
  const autoTopUp = MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
    body: {
      enabled: autoReload,
      thresholdCredits: 100,
      topUpCredits: 500,
      dailySpendCapCents: 5000,
    },
  });
  return {wallet, autoTopUp};
}

// The bar is a `ProgressBar`, which draws its fill in `:before`.
function barFillColor() {
  const bar = screen.getByRole('progressbar');
  const fill = Array.from(document.styleSheets)
    .flatMap(sheet => Array.from(sheet.cssRules))
    .findLast(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        /::?before$/.test(rule.selectorText) &&
        bar.matches(rule.selectorText.replace(/::?before$/, '')) &&
        !!rule.style.backgroundColor
    );
  return fill?.style.backgroundColor;
}

function cssColor(color: string) {
  const style = document.createElement('div').style;
  style.backgroundColor = color;
  return style.backgroundColor;
}

describe('SeerCreditUsageMeter', () => {
  const settingsUrl = `/settings/${billingOrganization.slug}/billing/overview/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('counts the month’s credits when auto-reload is off', async () => {
    mockWallet(billingOrganization);

    render(<SeerCreditUsageMeter hasEnoughCredits />, {
      organization: billingOrganization,
    });

    await userEvent.hover(await screen.findByText('75%'));

    expect(
      await screen.findByText(
        'Your organization has used 75% of your available monthly credits.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('250/1,000 credits remaining.')).toBeInTheDocument();
    // The out-of-credits alert, not the meter, is where auto-reload gets turned on.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says credits reload automatically when auto-reload is on', async () => {
    mockWallet(billingOrganization, {autoReload: true});

    render(<SeerCreditUsageMeter hasEnoughCredits />, {
      organization: billingOrganization,
    });

    await userEvent.hover(await screen.findByText('75%'));

    expect(
      await screen.findByText('Your organization has used 75% of your available credits.')
    ).toBeInTheDocument();
    expect(screen.getByText('Credits will reload automatically.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links to auto-reload when it has no auto-reloads left', async () => {
    mockWallet(billingOrganization, {autoReload: true, balance: 50, percentUsed: 0.95});

    render(<SeerCreditUsageMeter hasEnoughCredits={false} />, {
      organization: billingOrganization,
    });

    await userEvent.hover(await screen.findByText('95%'));

    expect(
      await screen.findByText(/You do not have any more auto-reloads available\./)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Configure auto-reload.'})).toHaveAttribute(
      'href',
      settingsUrl
    );
    expect(
      screen.queryByText('Credits will reload automatically.')
    ).not.toBeInTheDocument();
  });

  it('reloads the wallet when the window regains focus', async () => {
    const {wallet, autoTopUp} = mockWallet(billingOrganization);

    render(<SeerCreditUsageMeter hasEnoughCredits />, {
      organization: billingOrganization,
    });

    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(wallet).toHaveBeenCalledTimes(1);
    expect(autoTopUp).toHaveBeenCalledTimes(1);

    // An auto-reload in another tab.
    mockWallet(billingOrganization, {balance: 500, percentUsed: 0.5});
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });

    expect(await screen.findByText('50%')).toBeInTheDocument();
  });

  it('rounds the percent and counts purchased credits in the total', async () => {
    mockWallet(billingOrganization, {
      balance: 1250,
      percentUsed: 0.8754,
      included: 8000,
      purchased: 2000,
    });

    render(<SeerCreditUsageMeter hasEnoughCredits />, {
      organization: billingOrganization,
    });

    await userEvent.hover(await screen.findByText('88%'));

    expect(
      await screen.findByText('1,250/10,000 credits remaining.')
    ).toBeInTheDocument();
  });

  it.each([
    ['below 90% used', 0.89, true, 'neutral'],
    ['at 90% used', 0.9, true, 'warning'],
    ['when the organization cannot afford a message', 0.5, false, 'warning'],
  ] as const)('colors the bar %s', async (_, percentUsed, hasEnoughCredits, color) => {
    mockWallet(billingOrganization, {percentUsed});

    render(<SeerCreditUsageMeter hasEnoughCredits={hasEnoughCredits} />, {
      organization: billingOrganization,
    });

    await screen.findByRole('progressbar');
    const {graphics} = ThemeFixture().tokens;
    expect(barFillColor()).toBe(
      cssColor(color === 'warning' ? graphics.warning.vibrant : graphics.neutral.moderate)
    );
  });

  it('shows usage without auto-reload to members without billing access', async () => {
    const organization = OrganizationFixture({
      access: ['org:read'],
      features: ['seer-credit-checks', 'token-billed-seer-enabled'],
    });
    const {wallet, autoTopUp} = mockWallet(organization, {autoReload: true});

    render(<SeerCreditUsageMeter hasEnoughCredits={false} />, {organization});

    await userEvent.hover(await screen.findByText('75%'));

    expect(
      await screen.findByText('Your organization has used 75% of your available credits.')
    ).toBeInTheDocument();
    expect(screen.getByText('250/1,000 credits remaining.')).toBeInTheDocument();
    expect(
      screen.queryByText('Credits will reload automatically.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/You do not have any more auto-reloads available\./)
    ).not.toBeInTheDocument();
    expect(wallet).toHaveBeenCalledTimes(1);
    expect(autoTopUp).not.toHaveBeenCalled();
  });

  it('shows nothing without seer-credit-checks', () => {
    const organization = OrganizationFixture({access: ['org:read', 'org:billing']});
    const {wallet, autoTopUp} = mockWallet(organization);

    render(<SeerCreditUsageMeter hasEnoughCredits />, {organization});

    expect(screen.queryByTestId('seer-credit-usage-meter')).not.toBeInTheDocument();
    expect(wallet).not.toHaveBeenCalled();
    expect(autoTopUp).not.toHaveBeenCalled();
  });

  it('shows nothing when the organization has no Seer wallet', async () => {
    const wallet = MockApiClient.addMockResponse({
      url: `/customers/${billingOrganization.slug}/seer-wallet/`,
      statusCode: 404,
      body: {detail: 'Not found'},
    });
    const autoTopUp = MockApiClient.addMockResponse({
      url: `/customers/${billingOrganization.slug}/seer-wallet/auto-top-up/`,
      statusCode: 404,
      body: {detail: 'Not found'},
    });

    render(<SeerCreditUsageMeter hasEnoughCredits />, {
      organization: billingOrganization,
    });

    await waitFor(() => expect(wallet).toHaveBeenCalledTimes(1));
    expect(autoTopUp).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('seer-credit-usage-meter')).not.toBeInTheDocument();
  });
});
