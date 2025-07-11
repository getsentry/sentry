import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import {
  CronsBannerOnDemandCTA,
  CronsBannerUpgradeCTA,
} from 'getsentry/components/crons/cronsBannerUpgradeCTA';

jest.mock('getsentry/actionCreators/upsell', () => ({
  sendUpgradeRequest: jest.fn(),
}));

jest.mock('sentry/actionCreators/modal', () => ({
  openModal: jest.fn(),
}));

describe('CronsBannerUpgradeCTA', function () {
  const mockSendUpgradeRequest = sendUpgradeRequest as jest.MockedFunction<
    typeof sendUpgradeRequest
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const organization = OrganizationFixture();

  // Standard subscription that is self-serve and not managed
  const subscription = SubscriptionFixture({
    organization,
    canSelfServe: true,
    isManaged: false,
  });

  it('renders upgrade now button for users with billing access', function () {
    render(<CronsBannerUpgradeCTA hasBillingAccess subscription={subscription} />);

    expect(screen.getByText('Upgrade Now')).toBeInTheDocument();
  });

  it('renders request upgrade button for users without billing access', function () {
    render(
      <CronsBannerUpgradeCTA hasBillingAccess={false} subscription={subscription} />
    );

    expect(screen.getByText('Request Upgrade')).toBeInTheDocument();
  });

  it('calls sendUpgradeRequest when request upgrade button is clicked', async function () {
    render(
      <CronsBannerUpgradeCTA hasBillingAccess={false} subscription={subscription} />
    );

    await userEvent.click(screen.getByText('Request Upgrade'));

    expect(mockSendUpgradeRequest).toHaveBeenCalledTimes(1);
  });

  it('hides request upgrade button for non-self-serve plans', function () {
    const nonSelfServeSubscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
      isManaged: false,
    });

    const {container} = render(
      <CronsBannerUpgradeCTA
        hasBillingAccess={false}
        subscription={nonSelfServeSubscription}
      />
    );

    expect(screen.queryByText('Request Upgrade')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('hides request upgrade button for managed plans', function () {
    const managedSubscription = SubscriptionFixture({
      organization,
      canSelfServe: true,
      isManaged: true,
    });

    const {container} = render(
      <CronsBannerUpgradeCTA
        hasBillingAccess={false}
        subscription={managedSubscription}
      />
    );

    expect(screen.queryByText('Request Upgrade')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CronsBannerOnDemandCTA', function () {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
  });

  it('renders update plan button for users with billing access', function () {
    render(<CronsBannerOnDemandCTA hasBillingAccess subscription={subscription} />);

    expect(screen.getByText('Update Plan')).toBeInTheDocument();
  });

  it('renders nothing for users without billing access', function () {
    const {container} = render(
      <CronsBannerOnDemandCTA hasBillingAccess={false} subscription={subscription} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
