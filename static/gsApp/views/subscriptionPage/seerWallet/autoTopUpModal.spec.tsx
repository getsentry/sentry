import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {SeerCreditDenialReason} from 'sentry/utils/seer/useSeerCreditCheck';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import type {SeerWalletAutoTopUp} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

function AutoTopUpFixture(
  params: Partial<SeerWalletAutoTopUp> = {}
): SeerWalletAutoTopUp {
  return {
    enabled: false,
    thresholdCredits: 500,
    topUpCredits: 1500,
    dailySpendCapCents: 7500,
    minTopUpCredits: 1500,
    ...params,
  };
}

function savedSettings({
  minTopUpCredits: _minTopUpCredits,
  ...settings
}: SeerWalletAutoTopUp) {
  return settings;
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

  async function toggleAutoReload() {
    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Auto-reload enabled'})
    );
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

    await toggleAutoReload();
    expect(
      screen.getByText('Whenever your credits are at or below $5, purchase this amount')
    ).toBeInTheDocument();
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
      screen.getByRole('button', {name: 'Save and pay $25.00 + tax'})
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

  it('charges right away when the balance is at the threshold', async () => {
    openAutoTopUpModal({balance: 500});

    await toggleAutoReload();
    expect(screen.getByText('Due now')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Save and pay $15.00 + tax'})
    ).toBeInTheDocument();
  });

  it('turns on without a charge when the balance is above the threshold', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 1500}),
    });
    openAutoTopUpModal({balance: 501});

    await toggleAutoReload();
    expect(screen.queryByText('Due now')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: savedSettings(AutoTopUpFixture({enabled: true, topUpCredits: 1500})),
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

    await toggleAutoReload();
    await userEvent.click(screen.getByRole('radio', {name: 'Custom'}));
    const customAmount = screen.getByRole('textbox', {name: 'Custom credit amount'});
    expect(customAmount).toHaveValue('15');

    await userEvent.clear(customAmount);
    await userEvent.type(customAmount, '175');
    expect(screen.getByText('17,500 credits')).toBeInTheDocument();

    const dailyLimit = screen.getByRole('textbox', {name: 'Daily usage limit'});
    await userEvent.clear(dailyLimit);
    await userEvent.type(dailyLimit, '15');

    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $175.00 + tax'})
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

  it('turns back on with the custom amount saved before turning off', async () => {
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: false, topUpCredits: 2000}),
    });

    await toggleAutoReload();
    expect(screen.getByRole('radio', {name: 'Custom'})).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Custom credit amount'})).toHaveValue('20');
    expect(
      screen.getByRole('button', {name: 'Save and pay $20.00 + tax'})
    ).toBeInTheDocument();
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

  it('shows an unset daily usage limit as no limit', async () => {
    openAutoTopUpModal({autoTopUp: AutoTopUpFixture({dailySpendCapCents: null})});

    const dailyLimit = await screen.findByRole('textbox', {name: 'Daily usage limit'});
    expect(dailyLimit).toHaveValue('');
    expect(dailyLimit).toHaveAttribute('placeholder', 'No limit');
  });

  it('saves no daily usage limit when the field is cleared', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 2500}),
    });
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: true, topUpCredits: 2500}),
    });

    const dailyLimit = await screen.findByRole('textbox', {name: 'Daily usage limit'});
    await userEvent.clear(dailyLimit);
    expect(dailyLimit).toHaveValue('');
    expect(
      screen.queryByText('A $0 limit turns off all Seer usage.')
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          enabled: true,
          thresholdCredits: 500,
          topUpCredits: 2500,
          dailySpendCapCents: null,
        },
      })
    );
  });

  it('blocks a credit amount below the minimum', async () => {
    const saveMock = MockApiClient.addMockResponse({url, method: 'PUT', body: {}});
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: true, topUpCredits: 2500}),
    });

    await userEvent.click(await screen.findByRole('radio', {name: 'Custom'}));
    const customAmount = screen.getByRole('textbox', {name: 'Custom credit amount'});
    await userEvent.clear(customAmount);
    await userEvent.type(customAmount, '14');

    expect(
      screen.getByText('The credit amount must be at least $15.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();

    await userEvent.type(customAmount, '0');
    expect(
      screen.queryByText('The credit amount must be at least $15.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('warns about a $0 daily usage limit and still saves it', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 2500, dailySpendCapCents: 0}),
    });
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: true, topUpCredits: 2500}),
    });

    const dailyLimit = await screen.findByRole('textbox', {name: 'Daily usage limit'});
    await userEvent.clear(dailyLimit);
    await userEvent.type(dailyLimit, '0');

    expect(screen.getByText('A $0 limit turns off all Seer usage.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          enabled: true,
          thresholdCredits: 500,
          topUpCredits: 2500,
          dailySpendCapCents: 0,
        },
      })
    );
  });

  it('saves the daily usage limit without turning on auto-reload', async () => {
    const saveMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({dailySpendCapCents: 2000}),
    });
    openAutoTopUpModal();

    const dailyLimit = await screen.findByRole('textbox', {name: 'Daily usage limit'});
    expect(screen.getByRole('checkbox', {name: 'Auto-reload enabled'})).not.toBeChecked();
    expect(
      screen.queryByRole('radiogroup', {name: 'Credit amount'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Due now')).not.toBeInTheDocument();

    await userEvent.clear(dailyLimit);
    await userEvent.type(dailyLimit, '20');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          enabled: false,
          thresholdCredits: 500,
          topUpCredits: 1500,
          dailySpendCapCents: 2000,
        },
      })
    );
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
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

    // An amount picked before switching off is hidden, so it isn't saved.
    await userEvent.click(await screen.findByRole('radio', {name: '$50 5,000 credits'}));
    await toggleAutoReload();
    expect(
      screen.queryByRole('radiogroup', {name: 'Credit amount'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(
      screen.getByText(
        'Your 1,200 purchased credits will remain, and expire on Oct 1, 2027. When they run out, Seer pauses until your included credits reset.'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Keep it on'}));
    expect(saveMock).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', {name: 'Auto-reload enabled'})).toBeChecked();

    await toggleAutoReload();
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await userEvent.click(screen.getByRole('button', {name: 'Turn off'}));

    expect(saveMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({data: savedSettings({...autoTopUp, enabled: false})})
    );
  });

  it('leaves out the expiry date when there is none', async () => {
    openAutoTopUpModal({
      autoTopUp: AutoTopUpFixture({enabled: true}),
      purchasedRemaining: 1200,
    });

    await toggleAutoReload();
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      screen.getByText(
        'Your 1,200 purchased credits will remain. When they run out, Seer pauses until your included credits reset.'
      )
    ).toBeInTheDocument();
  });

  it('leaves out purchased credits when none remain', async () => {
    openAutoTopUpModal({autoTopUp: AutoTopUpFixture({enabled: true})});

    await toggleAutoReload();
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

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

    await toggleAutoReload();
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $15.00 + tax'})
    );

    expect(
      await screen.findByText('Ensure this value is greater than or equal to 1.')
    ).toBeInTheDocument();
  });

  it('verifies the first auto-reload charge with the bank', async () => {
    const walletMock = MockApiClient.addMockResponse({
      url: walletUrl,
      body: {
        balance: 0,
        creditPriceCents: 1,
        percentUsed: 1,
        included: {total: 500, remaining: 0, resetsAt: null},
        purchased: {total: 0, remaining: 0, expiresAt: null},
      },
    });
    const autoTopUpMock = MockApiClient.addMockResponse({url, body: AutoTopUpFixture()});
    MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 402,
      body: {
        invoiceGuid: 'invoice-guid',
        verification: {
          required: true,
          paymentIntentId: 'pi_123',
          clientSecret: 'pi_secret',
        },
      },
    });
    const confirmMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/invoice-guid/confirm/`,
      method: 'POST',
      body: {paid: true},
    });
    renderGlobalModal({organization});
    act(() => openSeerAutoTopUpModal({organization}));

    await toggleAutoReload();
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $15.00 + tax'})
    );
    // Auto-reload stays off until the refill is paid, so the settings go again.
    const resendMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 1500}),
    });
    await userEvent.click(
      await screen.findByRole('button', {name: 'Verify with your bank'})
    );

    expect(confirmMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/payments/invoice-guid/confirm/`,
      expect.objectContaining({data: {paymentIntentId: 'test-payment'}})
    );
    expect(await screen.findByText('Auto-reload turned on')).toBeInTheDocument();
    expect(resendMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: expect.objectContaining({enabled: true, topUpCredits: 1500}),
      })
    );
    expect(walletMock).toHaveBeenCalledTimes(3);
    expect(autoTopUpMock).toHaveBeenCalledTimes(3);
  });

  it('pays an earlier unpaid refill before turning auto-reload on', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 402,
      body: {
        detail: 'Pay your last Seer credit purchase to turn on auto-load.',
        invoiceId: 3,
        invoiceGuid: 'pending-guid',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/pending-guid/new/`,
      body: {
        amount: '1500',
        clientSecret: 'pi_secret',
        currency: 'usd',
        returnUrl: 'https://example.com/',
        paymentIntentId: 'pi_123',
        requiresAction: true,
      },
    });
    const confirmMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/pending-guid/confirm/`,
      method: 'POST',
      body: {paid: true},
    });
    openAutoTopUpModal();

    await toggleAutoReload();
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $15.00 + tax'})
    );

    expect(
      await screen.findByText('Pay your last Seer credit purchase to turn on auto-load.')
    ).toBeInTheDocument();

    const resendMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: AutoTopUpFixture({enabled: true, topUpCredits: 1500}),
    });
    await userEvent.click(
      await screen.findByRole('button', {name: 'Verify with your bank'})
    );

    expect(confirmMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/payments/pending-guid/confirm/`,
      expect.objectContaining({data: {paymentIntentId: 'test-payment'}})
    );
    expect(await screen.findByText('Auto-reload turned on')).toBeInTheDocument();
    expect(resendMock).toHaveBeenCalledTimes(1);
  });

  it('returns to the entered settings when the earlier refill cannot be paid', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 402,
      body: {
        detail: 'Pay your last Seer credit purchase to turn on auto-load.',
        invoiceId: 3,
        invoiceGuid: 'pending-guid',
      },
    });
    const intentMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/pending-guid/new/`,
      statusCode: 400,
      body: {detail: 'No payment method on file.'},
    });
    openAutoTopUpModal();

    await toggleAutoReload();
    await userEvent.click(screen.getByRole('radio', {name: '$25 2,500 credits'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $25.00 + tax'})
    );

    expect(await screen.findByText('No payment method on file.')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: '$25 2,500 credits'})).toBeChecked();
    expect(intentMock).toHaveBeenCalledTimes(1);
  });

  it('requests the payment again after a refetch failed', async () => {
    const intentUrl = `/organizations/${organization.slug}/payments/pending-guid/new/`;
    MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 402,
      body: {
        detail: 'Pay your last Seer credit purchase to turn on auto-load.',
        invoiceId: 3,
        invoiceGuid: 'pending-guid',
      },
    });
    // The bank check fails, which makes the payment form refetch the intent.
    MockApiClient.addMockResponse({
      url: intentUrl,
      body: {
        amount: '1500',
        clientSecret: 'ERROR',
        currency: 'usd',
        returnUrl: 'https://example.com/',
        paymentIntentId: 'pi_1',
        requiresAction: true,
      },
    });
    openAutoTopUpModal();

    await toggleAutoReload();
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $15.00 + tax'})
    );
    const conflictMock = MockApiClient.addMockResponse({
      url: intentUrl,
      statusCode: 409,
      body: {detail: 'A payment attempt for this invoice is already in progress.'},
    });
    await userEvent.click(
      await screen.findByRole('button', {name: 'Verify with your bank'})
    );

    expect(
      await screen.findByText(
        'A payment attempt for this invoice is already in progress.'
      )
    ).toBeInTheDocument();
    expect(conflictMock).toHaveBeenCalledTimes(1);

    const intentMock = MockApiClient.addMockResponse({
      url: intentUrl,
      body: {
        amount: '1500',
        clientSecret: 'pi_secret',
        currency: 'usd',
        returnUrl: 'https://example.com/',
        paymentIntentId: 'pi_2',
        requiresAction: true,
      },
    });
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $15.00 + tax'})
    );

    expect(
      await screen.findByRole('button', {name: 'Verify with your bank'})
    ).toBeInTheDocument();
    expect(intentMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('A payment attempt for this invoice is already in progress.')
    ).not.toBeInTheDocument();
  });

  it('returns to the entered settings when bank verification fails', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 402,
      body: {
        invoiceGuid: 'invoice-guid',
        verification: {required: true, paymentIntentId: 'pi_123', clientSecret: 'ERROR'},
      },
    });
    openAutoTopUpModal();

    await toggleAutoReload();
    await userEvent.click(screen.getByRole('radio', {name: '$25 2,500 credits'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $25.00 + tax'})
    );
    await userEvent.click(
      await screen.findByRole('button', {name: 'Verify with your bank'})
    );

    expect(await screen.findByText(/authentication failed/)).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: '$25 2,500 credits'})).toBeChecked();
    expect(
      screen.getByRole('button', {name: 'Save and pay $25.00 + tax'})
    ).toBeInTheDocument();
  });

  it('returns to the entered settings when bank verification is cancelled', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      statusCode: 402,
      body: {
        invoiceGuid: 'invoice-guid',
        verification: {
          required: true,
          paymentIntentId: 'pi_123',
          clientSecret: 'pi_secret',
        },
      },
    });
    openAutoTopUpModal();

    await toggleAutoReload();
    await userEvent.click(screen.getByRole('radio', {name: '$25 2,500 credits'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and pay $25.00 + tax'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    expect(screen.getByRole('radio', {name: '$25 2,500 credits'})).toBeChecked();
    expect(
      screen.getByRole('button', {name: 'Save and pay $25.00 + tax'})
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

  describe('without billing access', () => {
    const member = OrganizationFixture({access: ['org:read']});

    function openForMember({
      canSelfServe,
      denialReason,
    }: {
      canSelfServe: boolean;
      denialReason: SeerCreditDenialReason | null;
    }) {
      act(() =>
        SubscriptionStore.set(
          member.slug,
          // Tests run with the clock frozen at 2017-10-17, inside this period.
          SubscriptionFixture({
            organization: member,
            canSelfServe,
            onDemandPeriodStart: '2017-10-01',
          })
        )
      );
      MockApiClient.addMockResponse({
        url: `/organizations/${member.slug}/prompts-activity/`,
        body: {},
      });
      renderGlobalModal({organization: member});
      act(() => openSeerAutoTopUpModal({organization: member, denialReason}));
    }

    it('lets members of self-serve orgs ask their admins about what stopped Seer', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${member.slug}/prompts-activity/`,
        method: 'PUT',
      });
      const request = MockApiClient.addMockResponse({
        url: `/organizations/${member.slug}/seer-top-up-request/`,
        method: 'POST',
      });
      openForMember({canSelfServe: true, denialReason: 'daily_cap_exceeded'});

      expect(
        await screen.findByText(
          'Your organization hit its daily Seer usage limit. Only owners and billing members can manage auto-reload, so ask your admin to increase the limit.'
        )
      ).toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', {name: 'Contact Admin'}));

      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          `/organizations/${member.slug}/seer-top-up-request/`,
          expect.objectContaining({data: {denialReason: 'daily_cap_exceeded'}})
        )
      );
      expect(await screen.findByRole('button', {name: 'Admins emailed'})).toBeDisabled();
    });

    it('lets members email their admins when the link does not say why Seer stopped', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${member.slug}/prompts-activity/`,
        method: 'PUT',
      });
      const request = MockApiClient.addMockResponse({
        url: `/organizations/${member.slug}/seer-top-up-request/`,
        method: 'POST',
      });
      openForMember({canSelfServe: true, denialReason: null});

      expect(
        screen.getByText(
          'Only owners and billing members can manage auto-reload. Ask your admin to turn it on or increase your daily usage limit.'
        )
      ).toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', {name: 'Contact Admin'}));

      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          `/organizations/${member.slug}/seer-top-up-request/`,
          expect.objectContaining({data: {denialReason: null}})
        )
      );
    });

    describe('with credit checks', () => {
      const checkedMember = OrganizationFixture({
        access: ['org:read'],
        features: ['token-billed-seer-enabled'],
      });

      function openWithCreditCheck({
        linkDenialReason,
        creditCheck,
      }: {
        creditCheck: {
          denialReason: SeerCreditDenialReason | null;
          hasEnoughCredits: boolean;
        };
        linkDenialReason: SeerCreditDenialReason;
      }) {
        act(() =>
          SubscriptionStore.set(
            checkedMember.slug,
            SubscriptionFixture({
              organization: checkedMember,
              canSelfServe: true,
              onDemandPeriodStart: '2017-10-01',
            })
          )
        );
        MockApiClient.addMockResponse({
          url: `/organizations/${checkedMember.slug}/prompts-activity/`,
          body: {},
        });
        MockApiClient.addMockResponse({
          url: `/organizations/${checkedMember.slug}/prompts-activity/`,
          method: 'PUT',
        });
        MockApiClient.addMockResponse({
          url: `/organizations/${checkedMember.slug}/seer/credit-check/`,
          body: creditCheck,
          // Autofix's most expensive step, so a balance a chat message fits in
          // can't hide Contact Admin while Autofix is blocked.
          match: [MockApiClient.matchQuery({operation: 'autofix_pr_iteration'})],
        });
        const request = MockApiClient.addMockResponse({
          url: `/organizations/${checkedMember.slug}/seer-top-up-request/`,
          method: 'POST',
        });
        renderGlobalModal({organization: checkedMember});
        act(() =>
          openSeerAutoTopUpModal({
            organization: checkedMember,
            denialReason: linkDenialReason,
          })
        );
        return request;
      }

      it('tells members what stops Seer now, not what the link says', async () => {
        const request = openWithCreditCheck({
          linkDenialReason: 'not_enough_credits',
          creditCheck: {hasEnoughCredits: false, denialReason: 'daily_cap_exceeded'},
        });

        expect(
          await screen.findByText(
            'Your organization hit its daily Seer usage limit. Only owners and billing members can manage auto-reload, so ask your admin to increase the limit.'
          )
        ).toBeInTheDocument();
        // Tests run in UTC with the clock frozen at 2017-10-17T02:41:20Z, so the
        // limit resets at the next midnight UTC.
        expect(screen.getByRole('dialog')).toHaveTextContent(
          'This will reset at 12:00 AM UTC.'
        );
        await userEvent.click(await screen.findByRole('button', {name: 'Contact Admin'}));

        await waitFor(() =>
          expect(request).toHaveBeenCalledWith(
            `/organizations/${checkedMember.slug}/seer-top-up-request/`,
            expect.objectContaining({data: {denialReason: 'daily_cap_exceeded'}})
          )
        );
      });

      it('tells members Seer is available once it is no longer stopped', async () => {
        const request = openWithCreditCheck({
          linkDenialReason: 'daily_cap_exceeded',
          creditCheck: {hasEnoughCredits: true, denialReason: null},
        });

        expect(
          await screen.findByText(
            'Seer is available, so there is no need to contact your admin.'
          )
        ).toBeInTheDocument();
        expect(
          screen.queryByRole('button', {name: 'Contact Admin'})
        ).not.toBeInTheDocument();
        expect(request).not.toHaveBeenCalled();
      });

      it('waits for a new check rather than a cached one when opened again', async () => {
        openWithCreditCheck({
          linkDenialReason: 'daily_cap_exceeded',
          creditCheck: {hasEnoughCredits: true, denialReason: null},
        });
        expect(
          await screen.findByText(
            'Seer is available, so there is no need to contact your admin.'
          )
        ).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Close'}));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        // The org hits its daily usage limit before the member opens the link again.
        MockApiClient.addMockResponse({
          url: `/organizations/${checkedMember.slug}/seer/credit-check/`,
          body: {hasEnoughCredits: false, denialReason: 'daily_cap_exceeded'},
        });
        act(() =>
          openSeerAutoTopUpModal({
            organization: checkedMember,
            denialReason: 'daily_cap_exceeded',
          })
        );

        expect(
          screen.queryByText(
            'Seer is available, so there is no need to contact your admin.'
          )
        ).not.toBeInTheDocument();
        expect(await screen.findByRole('button', {name: 'Contact Admin'})).toBeEnabled();
      });

      it('does not email admins when Seer is available again by the time of the click', async () => {
        const request = openWithCreditCheck({
          linkDenialReason: 'daily_cap_exceeded',
          creditCheck: {hasEnoughCredits: false, denialReason: 'daily_cap_exceeded'},
        });
        const contactAdmin = await screen.findByRole('button', {name: 'Contact Admin'});

        // The daily usage limit resets while the modal is open.
        const recheck = MockApiClient.addMockResponse({
          url: `/organizations/${checkedMember.slug}/seer/credit-check/`,
          body: {hasEnoughCredits: true, denialReason: null},
        });
        await userEvent.click(contactAdmin);

        expect(
          await screen.findByText(
            'Seer is available, so there is no need to contact your admin.'
          )
        ).toBeInTheDocument();
        expect(recheck).toHaveBeenCalled();
        expect(request).not.toHaveBeenCalled();
        expect(
          screen.queryByRole('button', {name: 'Contact Admin'})
        ).not.toBeInTheDocument();
      });
    });

    it('loads the subscription when the page has not', async () => {
      act(() => SubscriptionStore.init());
      MockApiClient.addMockResponse({
        url: `/customers/${member.slug}/`,
        body: SubscriptionFixture({organization: member, canSelfServe: true}),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${member.slug}/prompts-activity/`,
        body: {},
      });
      renderGlobalModal({organization: member});
      act(() =>
        openSeerAutoTopUpModal({organization: member, denialReason: 'not_enough_credits'})
      );

      // The title and close button stay up while the subscription loads.
      expect(
        screen.getByRole('heading', {name: 'Auto-reload credits'})
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Close Modal'})).toBeInTheDocument();
      expect(await screen.findByRole('button', {name: 'Contact Admin'})).toBeEnabled();
    });

    it('gives members of orgs that cannot self-serve no Contact Admin', () => {
      openForMember({canSelfServe: false, denialReason: 'not_enough_credits'});

      expect(
        screen.getByText(
          'Your organization ran out of Seer credits. Only owners and billing members can manage auto-reload, so ask your admin to turn it on.'
        )
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Contact Admin'})
      ).not.toBeInTheDocument();
    });
  });
});
