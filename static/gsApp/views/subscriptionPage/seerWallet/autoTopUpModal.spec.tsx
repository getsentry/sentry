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

  function mockWallet({
    balance,
    purchasedExpiresAt,
    purchasedRemaining,
  }: {
    balance: number;
    purchasedExpiresAt: string | null;
    purchasedRemaining: number;
  }) {
    MockApiClient.addMockResponse({
      url: walletUrl,
      body: {
        balance,
        creditPriceCents: 1,
        percentUsed: 1,
        included: {total: 500, remaining: 0, resetsAt: null},
        purchased: {
          total: purchasedRemaining,
          remaining: purchasedRemaining,
          expiresAt: purchasedExpiresAt,
        },
      },
    });
  }

  function openAutoTopUpModal({
    autoTopUp = AutoTopUpFixture(),
    balance = 0,
    purchasedExpiresAt = null,
    purchasedRemaining = 0,
  }: {
    autoTopUp?: SeerWalletAutoTopUp;
    balance?: number;
    purchasedExpiresAt?: string | null;
    purchasedRemaining?: number;
  } = {}) {
    mockWallet({balance, purchasedExpiresAt, purchasedRemaining});
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
      await screen.findByText('Whenever your credits drop below $5, purchase this amount')
    ).toBeInTheDocument();
    // The saved $10 isn't a preset, so turning on starts from the first one.
    expect(screen.getByRole('radio', {name: '$15 1,500 credits'})).toBeChecked();
    expect(
      screen.queryByRole('textbox', {name: 'Custom credit amount'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('Due now')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: '$25 2,500 credits'}));
    expect(screen.getByRole('radio', {name: '$25 2,500 credits'})).toBeChecked();
    expect(screen.getByText('$25.00')).toBeInTheDocument();

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

  it('turns on without a charge when the balance is above the threshold', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 1500}),
    });
    openAutoTopUpModal({balance: 500});

    const turnOn = await screen.findByRole('button', {name: 'Turn on'});
    expect(screen.queryByText('Due now')).not.toBeInTheDocument();

    await userEvent.click(turnOn);
    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: AutoTopUpFixture({enabled: true, topUpCredits: 1500}),
      })
    );
  });

  it('turns on auto-reload with a custom amount above the daily usage limit', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 17_500}),
    });
    openAutoTopUpModal();

    await userEvent.click(await screen.findByRole('radio', {name: 'Custom'}));
    const customAmount = screen.getByRole('textbox', {name: 'Custom credit amount'});
    expect(customAmount).toHaveValue('15');

    await userEvent.clear(customAmount);
    await userEvent.type(customAmount, '175');
    expect(screen.getByText('17,500 credits')).toBeInTheDocument();

    const dailyLimit = screen.getByRole('textbox', {name: 'Daily usage limit'});
    await userEvent.clear(dailyLimit);
    await userEvent.type(dailyLimit, '15');

    await userEvent.click(
      screen.getByRole('button', {name: 'Turn on and pay $175.00 + tax'})
    );

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          enabled: true,
          thresholdCredits: 500,
          topUpCredits: 17_500,
          dailySpendCapCents: 1500,
        },
      })
    );
  });

  it('edits a saved custom amount', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true}),
    });
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: true, topUpCredits: 50_000}),
    });

    expect(await screen.findByRole('radio', {name: 'Custom'})).toBeChecked();
    const customAmount = screen.getByRole('textbox', {name: 'Custom credit amount'});
    expect(customAmount).toHaveValue('500');
    expect(screen.queryByText('Due now')).not.toBeInTheDocument();

    await userEvent.clear(customAmount);
    await userEvent.type(customAmount, '40');
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

  it('switches a saved preset to another preset', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 5000}),
    });
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: true, topUpCredits: 2500}),
    });

    expect(await screen.findByRole('radio', {name: '$25 2,500 credits'})).toBeChecked();
    expect(
      screen.queryByRole('textbox', {name: 'Custom credit amount'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: '$50 5,000 credits'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          enabled: true,
          thresholdCredits: 500,
          topUpCredits: 5000,
          dailySpendCapCents: 7500,
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
    openAutoTopUpModal({
      autoTopUp,
      purchasedExpiresAt: '2027-10-01',
      purchasedRemaining: 1200,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn off auto-reload'})
    );
    expect(
      screen.getByText(
        'Your 1,200 purchased credits will remain, and expire on Oct 1, 2027. When they run out, Seer pauses until your included credits reset.'
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
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: true}),
      purchasedRemaining: 1200,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn off auto-reload'})
    );

    expect(
      screen.getByText(
        'Your 1,200 purchased credits will remain. When they run out, Seer pauses until your included credits reset.'
      )
    ).toBeInTheDocument();
  });

  it('leaves out purchased credits when none remain', async () => {
    openAutoTopUpModal({autoTopUp: AutoTopUpFixture({enabled: true})});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn off auto-reload'})
    );

    expect(
      screen.getByText(
        'When your included credits run out, Seer pauses until they reset.'
      )
    ).toBeInTheDocument();
  });

  it('shows validation errors from the API', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 400,
      body: {topUpCredits: ['Ensure this value is greater than or equal to 1.']},
    });
    openAutoTopUpModal();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn on and pay $15.00 + tax'})
    );

    expect(
      await screen.findByText('Ensure this value is greater than or equal to 1.')
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
