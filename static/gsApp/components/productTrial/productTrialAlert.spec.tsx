import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import ProductTrialAlert from 'getsentry/components/productTrial/productTrialAlert';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {ProductTrial} from 'getsentry/types';

jest.mock('getsentry/actionCreators/upsell', () => ({
  sendUpgradeRequest: jest.fn(),
}));

describe('ProductTrialAlert', function () {
  const mockSendUpgradeRequest = sendUpgradeRequest as jest.MockedFunction<
    typeof sendUpgradeRequest
  >;

  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);
    jest.clearAllMocks();

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
    expect(screen.getByText('Spans Trial')).toBeInTheDocument();
    expect(
      screen.getByText(`You have full access to unlimited Spans until ${trial.endDate}`)
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
    expect(screen.getByText('Profiling Trial')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your unlimited Profiling trial ended. Keep using more by upgrading your plan.'
      )
    ).toBeInTheDocument();
  });

  it('shows the Request Upgrade button for non-admin users with self-serve and non-managed plans during trial ending', async function () {
    const trial: ProductTrial = {
      category: DataCategory.TRANSACTIONS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(4, 'days').format(),
      lengthDays: 14,
    };

    // Create a paid plan with no billing access, self-serve and not managed
    const nonAdminOrg = OrganizationFixture({
      access: [], // No billing access
    });
    const selfServeSubscription = SubscriptionFixture({
      organization: nonAdminOrg,
      planDetails: {
        ...subscription.planDetails,
        price: 100, // Make it a paid plan
      },
      canSelfServe: true,
      isManaged: false,
    });

    render(
      <ProductTrialAlert
        api={api}
        organization={nonAdminOrg}
        subscription={selfServeSubscription}
        trial={trial}
        product={DataCategory.TRANSACTIONS}
      />
    );

    // Request Upgrade button should be present
    const requestUpgradeButton = screen.getByRole('button', {name: 'Request Upgrade'});
    expect(requestUpgradeButton).toBeInTheDocument();

    // Clicking the button should call sendUpgradeRequest
    await userEvent.click(requestUpgradeButton);
    expect(mockSendUpgradeRequest).toHaveBeenCalledTimes(1);
    expect(mockSendUpgradeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        api,
        organization: nonAdminOrg,
      })
    );
  });

  it('does not show the Request Upgrade button for non-self-serve plans during trial ending', function () {
    const trial: ProductTrial = {
      category: DataCategory.TRANSACTIONS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(4, 'days').format(),
      lengthDays: 14,
    };

    // Create a paid plan with no billing access and non-self-serve
    const nonAdminOrg = OrganizationFixture({
      access: [], // No billing access
    });
    const nonSelfServeSubscription = SubscriptionFixture({
      organization: nonAdminOrg,
      planDetails: {
        ...subscription.planDetails,
        price: 100, // Make it a paid plan
      },
      canSelfServe: false,
    });

    render(
      <ProductTrialAlert
        api={api}
        organization={nonAdminOrg}
        subscription={nonSelfServeSubscription}
        trial={trial}
        product={DataCategory.TRANSACTIONS}
      />
    );

    // Request Upgrade button should not be present
    expect(
      screen.queryByRole('button', {name: 'Request Upgrade'})
    ).not.toBeInTheDocument();
  });

  it('does not show the Request Upgrade button for managed plans during trial ending', function () {
    const trial: ProductTrial = {
      category: DataCategory.TRANSACTIONS,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(4, 'days').format(),
      lengthDays: 14,
    };

    // Create a paid plan with no billing access, self-serve but managed
    const nonAdminOrg = OrganizationFixture({
      access: [], // No billing access
    });
    const managedSubscription = SubscriptionFixture({
      organization: nonAdminOrg,
      planDetails: {
        ...subscription.planDetails,
        price: 100, // Make it a paid plan
      },
      canSelfServe: true,
      isManaged: true,
    });

    render(
      <ProductTrialAlert
        api={api}
        organization={nonAdminOrg}
        subscription={managedSubscription}
        trial={trial}
        product={DataCategory.TRANSACTIONS}
      />
    );

    // Request Upgrade button should not be present
    expect(
      screen.queryByRole('button', {name: 'Request Upgrade'})
    ).not.toBeInTheDocument();
  });

  it('shows the Request Upgrade button for non-admin users with self-serve and non-managed plans after trial ended', async function () {
    const trial: ProductTrial = {
      category: DataCategory.PROFILES,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(16, 'days').format(),
      endDate: moment().utc().subtract(2, 'days').format(),
      lengthDays: 14,
    };

    // Create a paid plan with no billing access, self-serve and not managed
    const nonAdminOrg = OrganizationFixture({
      access: [], // No billing access
    });
    const selfServeSubscription = SubscriptionFixture({
      organization: nonAdminOrg,
      planDetails: {
        ...subscription.planDetails,
        price: 100, // Make it a paid plan
      },
      canSelfServe: true,
      isManaged: false,
    });

    render(
      <ProductTrialAlert
        api={api}
        organization={nonAdminOrg}
        subscription={selfServeSubscription}
        trial={trial}
        product={DataCategory.PROFILES}
      />
    );

    // Request Upgrade button should be present
    const requestUpgradeButton = screen.getByRole('button', {name: 'Request Upgrade'});
    expect(requestUpgradeButton).toBeInTheDocument();

    // Clicking the button should call sendUpgradeRequest
    await userEvent.click(requestUpgradeButton);
    expect(mockSendUpgradeRequest).toHaveBeenCalledTimes(1);
  });

  it('does not show the Request Upgrade button for non-self-serve plans after trial ended', function () {
    const trial: ProductTrial = {
      category: DataCategory.PROFILES,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(16, 'days').format(),
      endDate: moment().utc().subtract(2, 'days').format(),
      lengthDays: 14,
    };

    // Create a paid plan with no billing access and non-self-serve
    const nonAdminOrg = OrganizationFixture({
      access: [], // No billing access
    });
    const nonSelfServeSubscription = SubscriptionFixture({
      organization: nonAdminOrg,
      planDetails: {
        ...subscription.planDetails,
        price: 100, // Make it a paid plan
      },
      canSelfServe: false,
    });

    render(
      <ProductTrialAlert
        api={api}
        organization={nonAdminOrg}
        subscription={nonSelfServeSubscription}
        trial={trial}
        product={DataCategory.PROFILES}
      />
    );

    // Request Upgrade button should not be present
    expect(
      screen.queryByRole('button', {name: 'Request Upgrade'})
    ).not.toBeInTheDocument();
  });

  it('does not show the Request Upgrade button for managed plans after trial ended', function () {
    const trial: ProductTrial = {
      category: DataCategory.PROFILES,
      isStarted: true,
      reasonCode: 2001,
      startDate: moment().utc().subtract(16, 'days').format(),
      endDate: moment().utc().subtract(2, 'days').format(),
      lengthDays: 14,
    };

    // Create a paid plan with no billing access, self-serve but managed
    const nonAdminOrg = OrganizationFixture({
      access: [], // No billing access
    });
    const managedSubscription = SubscriptionFixture({
      organization: nonAdminOrg,
      planDetails: {
        ...subscription.planDetails,
        price: 100, // Make it a paid plan
      },
      canSelfServe: true,
      isManaged: true,
    });

    render(
      <ProductTrialAlert
        api={api}
        organization={nonAdminOrg}
        subscription={managedSubscription}
        trial={trial}
        product={DataCategory.PROFILES}
      />
    );

    // Request Upgrade button should not be present
    expect(
      screen.queryByRole('button', {name: 'Request Upgrade'})
    ).not.toBeInTheDocument();
  });
});
