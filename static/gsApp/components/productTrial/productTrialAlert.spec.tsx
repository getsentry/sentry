import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import ProductTrialAlert from 'getsentry/components/productTrial/productTrialAlert';
import {getProductForPath} from 'getsentry/components/productTrial/productTrialPaths';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {ProductTrial} from 'getsentry/types';

describe('ProductTrialAlert', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
  });

  it('loads available trial', function () {
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

  it('displays spans trial in progress', function () {
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
    expect(screen.getByText('Tracing Trial')).toBeInTheDocument();
    expect(
      screen.getByText(`You have full access to unlimited Tracing until ${trial.endDate}`)
    ).toBeInTheDocument();
  });

  it('loads trial started', function () {
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
    expect(screen.getByText('Error Monitoring Trial')).toBeInTheDocument();
    expect(
      screen.getByText(
        `You have full access to unlimited Error Monitoring until ${trial.endDate}`
      )
    ).toBeInTheDocument();
  });

  it('loads trial ending', function () {
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

  it('loads trial ended', function () {
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
});

describe('getProductForPath', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  it('returns LOG_BYTE product for /explore/logs/ path', function () {
    const result = getProductForPath(subscription, '/explore/logs/');
    expect(result).toEqual({
      product: DataCategory.LOG_BYTE,
      categories: [DataCategory.LOG_BYTE],
    });
  });

  it('returns ERRORS product for /issues/ path', function () {
    const result = getProductForPath(subscription, '/issues/');
    expect(result).toEqual({
      product: DataCategory.ERRORS,
      categories: [DataCategory.ERRORS],
    });
  });

  it('returns TRANSACTIONS product for /performance/ path', function () {
    const result = getProductForPath(subscription, '/performance/');
    expect(result).toEqual({
      product: DataCategory.TRANSACTIONS,
      categories: [DataCategory.TRANSACTIONS],
    });
  });

  it('returns REPLAYS product for /replays/ path', function () {
    const result = getProductForPath(subscription, '/replays/');
    expect(result).toEqual({
      product: DataCategory.REPLAYS,
      categories: [DataCategory.REPLAYS],
    });
  });

  it('returns PROFILES product for /profiling/ path', function () {
    const result = getProductForPath(subscription, '/profiling/');
    expect(result).toEqual({
      product: DataCategory.PROFILES,
      categories: [DataCategory.PROFILES, DataCategory.TRANSACTIONS],
    });
  });

  it('returns MONITOR_SEATS product for /insights/crons/ path', function () {
    const result = getProductForPath(subscription, '/insights/crons/');
    expect(result).toEqual({
      product: DataCategory.MONITOR_SEATS,
      categories: [DataCategory.MONITOR_SEATS],
    });
  });

  it('returns UPTIME product for /insights/uptime/ path', function () {
    const result = getProductForPath(subscription, '/insights/uptime/');
    expect(result).toEqual({
      product: DataCategory.UPTIME,
      categories: [DataCategory.UPTIME],
    });
  });

  it('returns TRANSACTIONS product for /traces/ path', function () {
    const result = getProductForPath(subscription, '/traces/');
    expect(result).toEqual({
      product: DataCategory.TRANSACTIONS,
      categories: [DataCategory.TRANSACTIONS],
    });
  });

  it('normalizes /explore/traces/ to /traces/', function () {
    const result = getProductForPath(subscription, '/explore/traces/');
    expect(result).toEqual({
      product: DataCategory.TRANSACTIONS,
      categories: [DataCategory.TRANSACTIONS],
    });
  });

  it('normalizes /explore/profiling/ to /profiling/', function () {
    const result = getProductForPath(subscription, '/explore/profiling/');
    expect(result).toEqual({
      product: DataCategory.PROFILES,
      categories: [DataCategory.PROFILES, DataCategory.TRANSACTIONS],
    });
  });

  it('normalizes /explore/replays/ to /replays/', function () {
    const result = getProductForPath(subscription, '/explore/replays/');
    expect(result).toEqual({
      product: DataCategory.REPLAYS,
      categories: [DataCategory.REPLAYS],
    });
  });

  it('returns null for unknown path', function () {
    const result = getProductForPath(subscription, '/unknown/');
    expect(result).toBeNull();
  });
});
