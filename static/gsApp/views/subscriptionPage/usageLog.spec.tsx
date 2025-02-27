import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {UsageLogFixture} from 'getsentry-test/fixtures/usageLog';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PlanTier} from 'getsentry/types';
import {UsageLog} from 'getsentry/views/subscriptionPage/usageLog';

describe('Subscription Usage Log', function () {
  const organization = OrganizationFixture({
    access: ['org:billing'],
  });
  const sub = SubscriptionFixture({organization});
  const mockLocation = LocationFixture();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: sub,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/usage-logs/`,
      method: 'GET',
      body: {
        rows: [],
        eventNames: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/`,
      query: {scheduled: 1, applied: 0},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
  });

  const eventNames = [
    'ondemand.edit',
    'trial.started',
    'plan.changed',
    'plan.cancelled',
    'spike-protection.activated',
    'spike-protection.deactivated',
    'spike-protection.disabled',
    'spike-protection.enabled',
    'trial.ended',
    'trial.extended',
  ];

  it('renders usage log', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/usage-logs/`,
      method: 'GET',
      body: {rows: [UsageLogFixture()], eventNames},
    });

    render(<UsageLog location={mockLocation} subscription={sub} />, {organization});

    await screen.findByText(/Select Action/i);
    expect(screen.getByText(/cancelled plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Sentry Staff/i)).toBeInTheDocument();
    expect(screen.getByText(/Jun/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Select Action/i));
    expect(screen.getByText(/Trial Extended/i)).toBeInTheDocument();
  });

  it('renders empty', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/usage-logs/`,
      method: 'GET',
      body: {rows: [], eventNames},
    });

    render(<UsageLog location={mockLocation} subscription={sub} />, {organization});

    await screen.findByText(/Select Action/i);
    expect(screen.getByText(/No entries available/i)).toBeInTheDocument();
  });

  it('keeps hypens in on-demand and PAYG', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/usage-logs/`,
      method: 'GET',
      body: {
        rows: [
          UsageLogFixture({event: 'ondemand.edit'}),
          UsageLogFixture({id: '1337', event: 'pay-as-you-go.edit'}),
        ],
        eventNames,
      },
    });

    render(<UsageLog location={mockLocation} subscription={sub} />, {organization});

    await screen.findByText(/Select Action/i);
    expect(screen.getByText('On-demand Edit')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go Edit')).toBeInTheDocument();
  });
});
