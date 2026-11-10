import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import type {SeerWalletAutoTopUp} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

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

describe('openSeerAutoTopUpModal', () => {
  const organization = OrganizationFixture({access: ['org:billing']});
  const url = `/customers/${organization.slug}/seer-wallet/auto-top-up/`;
  const walletUrl = `/customers/${organization.slug}/seer-wallet/`;

  function mockWallet({purchasedExpiresAt = null}: {purchasedExpiresAt?: string | null}) {
    MockApiClient.addMockResponse({
      url: walletUrl,
      body: {
        balance: 0,
        creditPriceCents: 1,
        percentUsed: 1,
        included: {total: 500, remaining: 0, resetsAt: null},
        purchased: {total: 0, remaining: 0, expiresAt: purchasedExpiresAt},
      },
    });
  }

  function openAutoTopUpModal({
    autoTopUp = AutoTopUpFixture(),
    purchasedExpiresAt = null,
  }: {
    autoTopUp?: SeerWalletAutoTopUp;
    purchasedExpiresAt?: string | null;
  } = {}) {
    mockWallet({purchasedExpiresAt});
    MockApiClient.addMockResponse({url, body: autoTopUp});
    renderGlobalModal({organization});
    act(() => openSeerAutoTopUpModal({organization}));
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('turns on auto-reload with a preset', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 2500}),
    });
    openAutoTopUpModal();

    expect(
      await screen.findByText('Added when your balance drops below $5, plus tax.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '$10', pressed: true})).toBeInTheDocument();
    expect(screen.getByText('$10.00 + tax')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: '$25'}));
    expect(screen.getByRole('button', {name: '$25', pressed: true})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Reload amount'})).toHaveValue('25');
    expect(screen.getByText('2,500 credits')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'Turn on and pay $25.00 + tax'})
    );

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          enabled: true,
          thresholdCredits: 500,
          topUpCredits: 2500,
          dailySpendCapCents: 7500,
        },
      })
    );
  });

  it('raises the daily limit to cover a larger preset', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 15_000}),
    });
    openAutoTopUpModal();

    const dailyLimit = await screen.findByRole('textbox', {name: 'Daily usage limit'});
    expect(dailyLimit).toHaveValue('75');

    await userEvent.click(screen.getByRole('button', {name: '$150'}));
    expect(dailyLimit).toHaveValue('150');

    await userEvent.click(screen.getByRole('button', {name: '$25'}));
    expect(dailyLimit).toHaveValue('150');

    await userEvent.click(screen.getByRole('button', {name: '$150'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Turn on and pay $150.00 + tax'})
    );

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          enabled: true,
          thresholdCredits: 500,
          topUpCredits: 15_000,
          dailySpendCapCents: 15_000,
        },
      })
    );
  });

  it('saves a custom reload amount and daily limit', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true}),
    });
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: true, topUpCredits: 50_000}),
    });

    const reloadAmount = await screen.findByRole('textbox', {name: 'Reload amount'});
    expect(reloadAmount).toHaveValue('500');
    for (const preset of ['$10', '$25', '$50', '$150']) {
      expect(
        screen.getByRole('button', {name: preset, pressed: false})
      ).toBeInTheDocument();
    }
    expect(screen.queryByText('Due now')).not.toBeInTheDocument();

    await userEvent.clear(reloadAmount);
    await userEvent.type(reloadAmount, '40');
    expect(screen.getByText('4,000 credits')).toBeInTheDocument();

    const dailyLimit = screen.getByRole('textbox', {name: 'Daily usage limit'});
    await userEvent.clear(dailyLimit);
    await userEvent.type(dailyLimit, '200');
    expect(screen.getByText('20,000 credits')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          enabled: true,
          thresholdCredits: 500,
          topUpCredits: 4000,
          dailySpendCapCents: 20_000,
        },
      })
    );
  });

  it('confirms before turning off auto-reload', async () => {
    const autoTopUp = AutoTopUpFixture({enabled: true, topUpCredits: 2500});
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: {...autoTopUp, enabled: false},
    });
    openAutoTopUpModal({autoTopUp, purchasedExpiresAt: '2027-10-01'});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn off auto-reload'})
    );
    expect(
      screen.getByText(
        'Your balance will remain, and expires on Oct 1, 2027. When it runs out, Seer pauses until your included credits reset.'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Keep it on'}));
    expect(saveMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Turn off auto-reload'}));
    await userEvent.click(screen.getByRole('button', {name: 'Turn off'}));

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({data: {...autoTopUp, enabled: false}})
    );
  });

  it('leaves out the expiry date when there is none', async () => {
    openAutoTopUpModal({autoTopUp: AutoTopUpFixture({enabled: true})});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn off auto-reload'})
    );

    expect(
      screen.getByText(
        'Your balance will remain. When it runs out, Seer pauses until your included credits reset.'
      )
    ).toBeInTheDocument();
  });

  it('shows validation errors from the API', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 400,
      body: {
        dailySpendCapCents: ['The daily spending cap must cover at least one top-up.'],
      },
    });
    openAutoTopUpModal();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn on and pay $10.00 + tax'})
    );

    expect(
      await screen.findByText('The daily spending cap must cover at least one top-up.')
    ).toBeInTheDocument();
  });

  it('offers a retry when the wallet fails to load', async () => {
    MockApiClient.addMockResponse({url: walletUrl, statusCode: 500, body: {}});
    MockApiClient.addMockResponse({url, body: AutoTopUpFixture()});
    renderGlobalModal({organization});
    act(() => openSeerAutoTopUpModal({organization}));

    expect(
      await screen.findByText('Unable to load your Seer credits.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });
});
