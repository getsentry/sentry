import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SubscriptionUpsellBanner} from './subscriptionUpsellBanner';

describe('SubscriptionUpsellBanner', () => {
  beforeEach(() => {
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/prompts-activity/`,
      body: promptResponse,
    });
    MockApiClient.addMockResponse({
      url: `/customers/org-slug/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/org-slug/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/org-slug/plan-migrations/`,
      query: {scheduled: 1, applied: 0},
      method: 'GET',
      body: [],
    });
  });

  it('should render banner for users on free plan with billing access', async () => {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
    });
    render(
      <SubscriptionUpsellBanner
        organization={organization}
        subscription={subscription}
      />,
      {organization}
    );

    expect(await screen.findByText('Try Sentry Business for Free')).toBeInTheDocument();
    expect(
      screen.getByText(/Activate your trial to take advantage of/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Start Trial'})).toBeInTheDocument();
  });

  it('should render banner for users on free plan without billing access', async () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
    });
    render(
      <SubscriptionUpsellBanner
        organization={organization}
        subscription={subscription}
      />,
      {organization}
    );

    expect(
      await screen.findByText('Request a Free Sentry Business Trial')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your Organization’s owner to start a Business plan/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Request Trial'})).toBeInTheDocument();
  });
});
