import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

import {HeaderCards} from 'getsentry/views/subscriptionPage/headerCards/headerCards';

describe('HeaderCards', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/subscription/next-bill/',
    });
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/billing-details/',
    });
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/seer-wallet/',
      body: {
        balance: 500,
        creditPriceCents: 1,
        included: {total: 500, remaining: 500, resetsAt: null},
        purchased: {total: 0, remaining: 0, expiresAt: null},
      },
    });
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/seer-wallet/auto-top-up/',
      body: {
        enabled: false,
        thresholdCredits: 500,
        topUpCredits: 1000,
        dailySpendCapCents: 7500,
      },
    });
  });

  function renderHeaderCards(organization = OrganizationFixture()) {
    const subscription = SubscriptionFixture({organization, plan: 'am3_team'});
    render(<HeaderCards organization={organization} subscription={subscription} />, {
      additionalWrapper: SecondaryNavigationContextProvider,
    });
  }

  it('renders the Seer wallet card for token-billed Seer', async () => {
    renderHeaderCards(
      OrganizationFixture({
        access: ['org:billing'],
        features: ['token-billed-seer-enabled'],
      })
    );

    expect(await screen.findByRole('heading', {name: 'Seer'})).toBeInTheDocument();
  });

  it('hides the Seer wallet card without token-billed Seer', async () => {
    renderHeaderCards(OrganizationFixture({access: ['org:billing']}));

    expect(
      await screen.findByRole('heading', {name: 'Receipts & notifications'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Seer'})).not.toBeInTheDocument();
  });

  it('hides the Seer wallet card without billing access', async () => {
    renderHeaderCards(OrganizationFixture({features: ['token-billed-seer-enabled']}));

    expect(
      await screen.findByRole('heading', {name: 'Activity log'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Seer'})).not.toBeInTheDocument();
  });
});
