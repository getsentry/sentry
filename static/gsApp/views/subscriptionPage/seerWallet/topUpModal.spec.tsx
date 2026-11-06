import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openSeerTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/topUpModal';

describe('openSeerTopUpModal', () => {
  const organization = OrganizationFixture({
    access: ['org:billing'],
    features: ['token-billed-seer-enabled', 'seer-credit-checks'],
  });
  const walletUrl = `/customers/${organization.slug}/seer-wallet/`;
  const autoTopUpUrl = `/customers/${organization.slug}/seer-wallet/auto-top-up/`;
  const autoTopUp = {
    enabled: false,
    thresholdCredits: 500,
    topUpCredits: 1000,
    dailySpendCapCents: 7500,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows the balance above the auto top-up settings and saves them', async () => {
    MockApiClient.addMockResponse({
      url: walletUrl,
      body: {
        balance: 0,
        creditPriceCents: 1,
        included: {total: 500, remaining: 0, resetsAt: null},
        purchased: {total: 0, remaining: 0, expiresAt: null},
      },
    });
    MockApiClient.addMockResponse({url: autoTopUpUrl, body: autoTopUp});
    const save = MockApiClient.addMockResponse({
      url: autoTopUpUrl,
      method: 'PUT',
      body: {...autoTopUp, enabled: true},
    });

    renderGlobalModal({organization});
    act(() => openSeerTopUpModal({organization}));

    expect(await screen.findByText('0 credits')).toBeInTheDocument();
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Auto top-up'})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        autoTopUpUrl,
        expect.objectContaining({data: {...autoTopUp, enabled: true}})
      )
    );
  });

  it('offers a retry when the wallet fails to load', async () => {
    MockApiClient.addMockResponse({url: walletUrl, statusCode: 500, body: {}});
    MockApiClient.addMockResponse({url: autoTopUpUrl, body: autoTopUp});

    renderGlobalModal({organization});
    act(() => openSeerTopUpModal({organization}));

    expect(
      await screen.findByText('Unable to load your Seer credits.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });
});
