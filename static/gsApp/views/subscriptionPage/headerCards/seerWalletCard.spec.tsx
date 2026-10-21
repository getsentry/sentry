import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

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

  it('shows free credits with auto top-up off', async () => {
    mockWallet();
    render(<SeerWalletCard organization={organization} />);

    expect(await screen.findByText('320')).toBeInTheDocument();
    expect(screen.getByText('of 500 credits available')).toBeInTheDocument();
    expect(screen.getByText('Auto top-up off')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Turn on auto top-up'})).toBeInTheDocument();
  });

  it('shows paused when credits are used up', async () => {
    mockWallet(
      WalletFixture({
        balance: 0,
        included: {total: 500, remaining: 0, resetsAt: '2026-11-01'},
      })
    );
    render(<SeerWalletCard organization={organization} />);

    expect(await screen.findByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Turn on auto top-up'})).toBeInTheDocument();
  });

  it('shows purchased credits with auto top-up on', async () => {
    mockWallet(
      WalletFixture({
        balance: 50_320,
        purchased: {total: 50_000, remaining: 50_000, expiresAt: '2027-10-01'},
      }),
      AutoTopUpFixture({enabled: true, thresholdCredits: 1000, topUpCredits: 50_000})
    );
    render(<SeerWalletCard organization={organization} />);

    expect(await screen.findByText('50,320')).toBeInTheDocument();
    expect(screen.getByText('of 50,500 credits available')).toBeInTheDocument();
    expect(screen.getByText('Auto top-up on')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit'})).toBeInTheDocument();
  });

  it('shows the credit breakdown on hover', async () => {
    mockWallet(
      WalletFixture({
        balance: 50_320,
        purchased: {total: 50_000, remaining: 50_000, expiresAt: '2027-10-01'},
      }),
      AutoTopUpFixture({
        enabled: true,
        thresholdCredits: 1000,
        topUpCredits: 50_000,
        dailySpendCapCents: 100_000,
      })
    );
    render(<SeerWalletCard organization={organization} />);

    await userEvent.hover(await screen.findByLabelText('Credit breakdown'));

    expect(await screen.findByText('Resets Nov 1')).toBeInTheDocument();
    expect(screen.getByText('320 remaining')).toBeInTheDocument();
    expect(screen.getByText('Expires Oct 1, 2027')).toBeInTheDocument();
    expect(screen.getByText('50,000 remaining')).toBeInTheDocument();
    expect(screen.getByText('100,000 / day')).toBeInTheDocument();
  });

  it('turns on auto top-up from the modal', async () => {
    mockWallet();
    const saveMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 2000}),
    });
    // Share one query client so saving in the modal refreshes the card.
    render(
      <Fragment>
        <SeerWalletCard organization={organization} />
        <GlobalModal />
      </Fragment>
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn on auto top-up'})
    );
    expect(
      await screen.findByText('$10 per top-up • (1 credit = $0.01)')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: '2,000'}));
    expect(screen.getByText('$20 per top-up • (1 credit = $0.01)')).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
      body: AutoTopUpFixture({enabled: true, topUpCredits: 2000}),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(saveMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
      expect.objectContaining({
        data: {
          enabled: true,
          thresholdCredits: 500,
          topUpCredits: 2000,
          dailySpendCapCents: 7500,
        },
      })
    );
    expect(await screen.findByText('Auto top-up on')).toBeInTheDocument();
  });

  it('disables the presets when auto top-up is switched off', async () => {
    mockWallet();
    render(<SeerWalletCard organization={organization} />);
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn on auto top-up'})
    );
    await userEvent.click(await screen.findByRole('checkbox', {name: 'Auto top-up'}));

    for (const preset of ['1,000', '2,000', '5,000']) {
      expect(screen.getByRole('radio', {name: preset})).toBeDisabled();
    }
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

  it('shows validation errors from the API', async () => {
    mockWallet();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
      method: 'PUT',
      statusCode: 400,
      body: {
        dailySpendCapCents: ['The daily spending cap must cover at least one top-up.'],
      },
    });
    render(<SeerWalletCard organization={organization} />);
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn on auto top-up'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('The daily spending cap must cover at least one top-up.')
    ).toBeInTheDocument();
  });
});
