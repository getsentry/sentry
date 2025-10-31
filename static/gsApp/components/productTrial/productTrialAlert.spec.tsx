import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import ProductTrialAlert from 'getsentry/components/productTrial/productTrialAlert';
import {getProductForPath} from 'getsentry/components/productTrial/productTrialPaths';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {ProductTrial} from 'getsentry/types';

describe('ProductTrialAlert', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
  });

  it('loads available trial', () => {
    const trial: ProductTrial = {
      category: DataCategory.REPLAYS,
      isStarted: false,
      reasonCode: 2001,
      endDate: moment().utc().add(20, 'days').format(),
      lengthDays: 14,
    };

    render(
      <ProductTrialAlert
        api={api}
        organization={organization}
        subscription={subscription}
        trial={trial}
        product={DataCategory.REPLAYS}
      />
    );
    expect(screen.getByText('Try Session Replay for free')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Activate your trial to take advantage of 14 days of unlimited Session Replay'
      )
    ).toBeInTheDocument();
  });

  it('displays spans trial in progress', () => {
    const trial: ProductTrial = {
      category: DataCategory.SPANS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(3, 'days').format(),
      endDate: moment().utc().add(11, 'days').format(),
      lengthDays: 14,
    };
    render(
      <ProductTrialAlert
        api={api}
        organization={organization}
        subscription={subscription}
        trial={trial}
        product={DataCategory.SPANS}
      />
    );
    expect(screen.getByText('Tracing Trial is currently active')).toBeInTheDocument();
    expect(
      screen.getByText(`You have full access to unlimited Tracing until ${trial.endDate}`)
    ).toBeInTheDocument();
  });

  it('loads trial started', () => {
    const trial: ProductTrial = {
      category: DataCategory.ERRORS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(3, 'days').format(),
      endDate: moment().utc().add(11, 'days').format(),
      lengthDays: 14,
    };

    render(
      <ProductTrialAlert
        api={api}
        organization={organization}
        subscription={subscription}
        trial={trial}
        product={DataCategory.ERRORS}
      />
    );
    expect(
      screen.getByText('Error Monitoring Trial is currently active')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `You have full access to unlimited Error Monitoring until ${trial.endDate}`
      )
    ).toBeInTheDocument();
  });

  it('loads trial ending', () => {
    const trial: ProductTrial = {
      category: DataCategory.TRANSACTIONS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(4, 'days').format(),
      lengthDays: 14,
    };

    render(
      <ProductTrialAlert
        api={api}
        organization={organization}
        subscription={subscription}
        trial={trial}
        product={DataCategory.TRANSACTIONS}
      />
    );
    expect(screen.getByText('Performance Monitoring Trial')).toBeInTheDocument();
    expect(
      screen.getByText(
        `Keep using more Performance Monitoring by upgrading your plan by ${trial.endDate}`
      )
    ).toBeInTheDocument();
  });

  it('loads trial ended', () => {
    const trial: ProductTrial = {
      category: DataCategory.PROFILES,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(16, 'days').format(),
      endDate: moment().utc().subtract(2, 'days').format(),
      lengthDays: 14,
    };

    render(
      <ProductTrialAlert
        api={api}
        organization={organization}
        subscription={subscription}
        trial={trial}
        product={DataCategory.PROFILES}
      />
    );
    expect(screen.getByText('Continuous Profiling Trial')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your unlimited Continuous Profiling trial ended. Keep using more by upgrading your plan.'
      )
    ).toBeInTheDocument();
  });

  it('does not show trial alert for managed subscriptions', () => {
    const managedSubscription = SubscriptionFixture({
      organization,
      partner: {
        externalId: '123',
        name: 'heroku',
        isActive: true,
        partnership: {
          id: '456',
          displayName: 'Heroku',
          supportNote: 'Contact Heroku to manage your subscription',
        },
      },
    });

    const trial: ProductTrial = {
      category: DataCategory.REPLAYS,
      isStarted: true,
      reasonCode: 2001,
      endDate: moment().utc().add(2, 'days').format(), // Ending soon
      lengthDays: 14,
    };

    const {container} = render(
      <ProductTrialAlert
        api={api}
        organization={organization}
        subscription={managedSubscription}
        trial={trial}
      />
    );

    // Should not render anything for managed subscriptions
    expect(container).toBeEmptyDOMElement();
  });

  it('does not show checkout link for partner subscription with trial ending', () => {
    const partnerSubscription = SubscriptionFixture({
      organization,
      partner: {
        externalId: '789',
        name: 'vercel',
        isActive: true,
        partnership: {
          id: '101',
          displayName: 'Vercel',
          supportNote: '<a href="https://vercel.com">Contact Vercel</a> to upgrade',
        },
      },
    });

    const trial: ProductTrial = {
      category: DataCategory.TRANSACTIONS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(3, 'days').format(), // Ending in 3 days
      lengthDays: 14,
    };

    const {container} = render(
      <ProductTrialAlert
        api={api}
        organization={organization}
        subscription={partnerSubscription}
        trial={trial}
      />
    );

    // Should not render anything for partner subscriptions
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Request Upgrade for users without billing permissions on paid plan', () => {
    const orgWithoutBillingPerms = OrganizationFixture({
      access: ['org:read', 'org:write'], // No 'org:billing'
    });

    const paidSubscription = SubscriptionFixture({
      organization: orgWithoutBillingPerms,
      planDetails: PlanDetailsLookupFixture('am3_team'),
    });

    const trial: ProductTrial = {
      category: DataCategory.REPLAYS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(2, 'days').format(), // Ending soon
      lengthDays: 14,
    };

    render(
      <ProductTrialAlert
        api={api}
        organization={orgWithoutBillingPerms}
        subscription={paidSubscription}
        trial={trial}
      />
    );

    expect(screen.getByText('Request Upgrade')).toBeInTheDocument();
    expect(screen.queryByText('Update Plan')).not.toBeInTheDocument();
  });

  it('shows Update Plan for users with billing permissions on paid plan', () => {
    const orgWithBillingPerms = OrganizationFixture({
      access: ['org:read', 'org:write', 'org:billing'],
    });

    const paidSubscription = SubscriptionFixture({
      organization: orgWithBillingPerms,
      planDetails: PlanDetailsLookupFixture('am3_team'),
    });

    const trial: ProductTrial = {
      category: DataCategory.REPLAYS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(2, 'days').format(), // Ending soon
      lengthDays: 14,
    };

    render(
      <ProductTrialAlert
        api={api}
        organization={orgWithBillingPerms}
        subscription={paidSubscription}
        trial={trial}
      />
    );

    expect(screen.getByText('Update Plan')).toBeInTheDocument();
    expect(screen.queryByText('Request Upgrade')).not.toBeInTheDocument();
  });

  it('does not show trial alert for managed subscription even with billing permissions', () => {
    const orgWithBillingPerms = OrganizationFixture({
      access: ['org:read', 'org:write', 'org:billing'],
    });

    const managedSubscription = SubscriptionFixture({
      organization: orgWithBillingPerms,
      partner: {
        externalId: '999',
        name: 'github',
        isActive: true,
        partnership: {
          id: '888',
          displayName: 'GitHub',
          supportNote: 'Manage your subscription through GitHub Marketplace',
        },
      },
    });

    const trial: ProductTrial = {
      category: DataCategory.ERRORS,
      isStarted: true,
      reasonCode: 2001,
      endDate: moment().utc().subtract(1, 'days').format(), // Ended yesterday
      lengthDays: 14,
    };

    const {container} = render(
      <ProductTrialAlert
        api={api}
        organization={orgWithBillingPerms}
        subscription={managedSubscription}
        trial={trial}
      />
    );

    // Even with billing permissions, managed subscriptions should not show trial alerts
    expect(container).toBeEmptyDOMElement();
  });
});

describe('getProductForPath', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  it('returns LOG_BYTE product for /explore/logs/ path', () => {
    const result = getProductForPath(subscription, '/explore/logs/');
    expect(result).toEqual({
      product: DataCategory.LOG_BYTE,
      categories: [DataCategory.LOG_BYTE],
    });
  });

  it('returns ERRORS product for /issues/ path', () => {
    const result = getProductForPath(subscription, '/issues/');
    expect(result).toEqual({
      product: DataCategory.ERRORS,
      categories: [DataCategory.ERRORS],
    });
  });

  it('returns TRANSACTIONS product for /performance/ path', () => {
    const result = getProductForPath(subscription, '/performance/');
    expect(result).toEqual({
      product: DataCategory.TRANSACTIONS,
      categories: [DataCategory.TRANSACTIONS],
    });
  });

  it('returns REPLAYS product for /replays/ path', () => {
    const result = getProductForPath(subscription, '/replays/');
    expect(result).toEqual({
      product: DataCategory.REPLAYS,
      categories: [DataCategory.REPLAYS],
    });
  });

  it('returns PROFILES product for /profiling/ path', () => {
    const result = getProductForPath(subscription, '/profiling/');
    expect(result).toEqual({
      product: DataCategory.PROFILES,
      categories: [DataCategory.PROFILES, DataCategory.TRANSACTIONS],
    });
  });

  it('returns MONITOR_SEATS product for /insights/crons/ path', () => {
    const result = getProductForPath(subscription, '/insights/crons/');
    expect(result).toEqual({
      product: DataCategory.MONITOR_SEATS,
      categories: [DataCategory.MONITOR_SEATS],
    });
  });

  it('returns UPTIME product for /insights/uptime/ path', () => {
    const result = getProductForPath(subscription, '/insights/uptime/');
    expect(result).toEqual({
      product: DataCategory.UPTIME,
      categories: [DataCategory.UPTIME],
    });
  });

  it('returns TRANSACTIONS product for /traces/ path', () => {
    const result = getProductForPath(subscription, '/traces/');
    expect(result).toEqual({
      product: DataCategory.TRANSACTIONS,
      categories: [DataCategory.TRANSACTIONS],
    });
  });

  it('normalizes /explore/traces/ to /traces/', () => {
    const result = getProductForPath(subscription, '/explore/traces/');
    expect(result).toEqual({
      product: DataCategory.TRANSACTIONS,
      categories: [DataCategory.TRANSACTIONS],
    });
  });

  it('normalizes /explore/profiling/ to /profiling/', () => {
    const result = getProductForPath(subscription, '/explore/profiling/');
    expect(result).toEqual({
      product: DataCategory.PROFILES,
      categories: [DataCategory.PROFILES, DataCategory.TRANSACTIONS],
    });
  });

  it('normalizes /explore/replays/ to /replays/', () => {
    const result = getProductForPath(subscription, '/explore/replays/');
    expect(result).toEqual({
      product: DataCategory.REPLAYS,
      categories: [DataCategory.REPLAYS],
    });
  });

  it('returns null for unknown path', () => {
    const result = getProductForPath(subscription, '/unknown/');
    expect(result).toBeNull();
  });
});
