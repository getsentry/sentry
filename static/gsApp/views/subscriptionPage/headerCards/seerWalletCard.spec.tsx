import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {SeerWalletCard} from 'getsentry/views/subscriptionPage/headerCards/seerWalletCard';
import type {
  SeerWalletAutoTopUp,
  SeerWalletBalance,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

function WalletFixture(params: Partial<SeerWalletBalance> = {}): SeerWalletBalance {
  return {
    balance: 320,
    creditPriceCents: 1,
    included: {total: 500, remaining: 320, resetsAt: '2026-11-01'},
    purchased: {total: 0, remaining: 0, expiresAt: null},
    percentUsed: 0.36,
    ...params,
  };
}

function AutoTopUpFixture(
  params: Partial<SeerWalletAutoTopUp> = {}
): SeerWalletAutoTopUp {
  return {
    enabled: false,
    thresholdCredits: 500,
    topUpCredits: 1000,
    dailySpendCapCents: 7500,
    ...params,
  };
}

describe('SeerWalletCard', () => {
  const organization = OrganizationFixture({
    access: ['org:billing'],
    features: ['token-billed-seer-enabled'],
  });

  function mockWallet(
    wallet: SeerWalletBalance = WalletFixture(),
    autoTopUp: SeerWalletAutoTopUp = AutoTopUpFixture()
  ) {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/`,
      body: wallet,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
      body: autoTopUp,
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows included credits with auto-reload off', async () => {
    mockWallet();
    render(<SeerWalletCard organization={organization} />);

    expect(await screen.findByText('320')).toBeInTheDocument();
    expect(
      screen.getByText('of 500 credits remaining • Resets Nov 1')
    ).toBeInTheDocument();
    expect(screen.getByText('Auto-reload • Off')).toBeInTheDocument();
    expect(screen.getByText('Buy more credits when you run low')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Set up'})).toBeInTheDocument();
    expect(screen.queryByText(/Paused/)).not.toBeInTheDocument();
  });

  it('shows when Seer resumes once credits are used up', async () => {
    mockWallet(
      WalletFixture({
        balance: -20,
        included: {total: 500, remaining: -20, resetsAt: '2026-11-01'},
      })
    );
    render(<SeerWalletCard organization={organization} />);

    expect(await screen.findByText('Paused until Nov 1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Set up'})).toBeInTheDocument();
  });

  it('shows paused without a date when auto-reload is on', async () => {
    mockWallet(
      WalletFixture({
        balance: 0,
        included: {total: 500, remaining: 0, resetsAt: '2026-11-01'},
      }),
      AutoTopUpFixture({enabled: true})
    );
    render(<SeerWalletCard organization={organization} />);

    expect(await screen.findByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manage'})).toBeInTheDocument();
  });

  it('counts purchased credits with auto-reload off', async () => {
    mockWallet(
      WalletFixture({
        balance: 1520,
        purchased: {total: 2000, remaining: 1200, expiresAt: '2027-10-01'},
      })
    );
    render(<SeerWalletCard organization={organization} />);

    expect(await screen.findByText('1,520')).toBeInTheDocument();
    expect(screen.getByText('credits remaining')).toBeInTheDocument();
    expect(screen.getByLabelText('Credit breakdown')).toBeInTheDocument();
    expect(screen.getByText('Auto-reload • Off')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Set up'})).toBeInTheDocument();
  });

  it('shows the auto-reload settings with auto-reload on', async () => {
    mockWallet(
      WalletFixture({
        balance: 50_320,
        purchased: {total: 50_000, remaining: 50_000, expiresAt: '2027-10-01'},
      }),
      AutoTopUpFixture({enabled: true, thresholdCredits: 1000, topUpCredits: 50_000})
    );
    render(<SeerWalletCard organization={organization} />);

    expect(await screen.findByText('50,320')).toBeInTheDocument();
    expect(screen.getByText('credits remaining')).toBeInTheDocument();
    expect(screen.getByText('Auto-reload • On')).toBeInTheDocument();
    expect(screen.getByText('Adds 50,000 credits when below 1,000')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manage'})).toBeInTheDocument();
  });

  it('shows the credit breakdown on hover', async () => {
    mockWallet(
      WalletFixture({
        balance: 50_320,
        purchased: {total: 50_000, remaining: 50_000, expiresAt: '2027-10-01'},
      }),
      AutoTopUpFixture({enabled: true})
    );
    render(<SeerWalletCard organization={organization} />);

    await userEvent.hover(await screen.findByLabelText('Credit breakdown'));

    expect(await screen.findByText('320 included credits remaining')).toBeInTheDocument();
    expect(screen.getByText('Resets to 500 on Nov 1')).toBeInTheDocument();
    expect(screen.getByText('50,000 purchased credits remaining')).toBeInTheDocument();
    expect(screen.getByText('Expires on Oct 1, 2027')).toBeInTheDocument();
  });

  it('turns on auto-reload from the modal', async () => {
    mockWallet();
    const saveMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true}),
    });
    // Share one query client so saving in the modal refreshes the card.
    render(
      <Fragment>
        <SeerWalletCard organization={organization} />
        <GlobalModal />
      </Fragment>
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Set up'}));

    mockWallet(
      WalletFixture({
        balance: 1320,
        purchased: {total: 1000, remaining: 1000, expiresAt: '2027-11-01'},
      }),
      AutoTopUpFixture({enabled: true})
    );
    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn on and pay $15.00 + tax'})
    );

    expect(saveMock).toHaveBeenCalled();
    expect(await screen.findByText('Auto-reload • On')).toBeInTheDocument();
    expect(await screen.findByText('1,320')).toBeInTheDocument();
    expect(screen.getByText('Adds 1,000 credits when below 500')).toBeInTheDocument();
  });

  it('shows an error when the wallet fails to load', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/`,
      statusCode: 500,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
      body: AutoTopUpFixture(),
    });
    render(<SeerWalletCard organization={organization} />);

    expect(
      await screen.findByText('Unable to load your Seer credits.')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });
});
