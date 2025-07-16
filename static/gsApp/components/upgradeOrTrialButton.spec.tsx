import userEvent from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {sendTrialRequest, sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';

jest.mock('getsentry/actionCreators/upsell', () => ({
  sendTrialRequest: jest.fn(),
  sendUpgradeRequest: jest.fn(),
}));

describe('UpgradeOrTrialButton', function () {
  const mockSendTrialRequest = sendTrialRequest as jest.MockedFunction<
    typeof sendTrialRequest
  >;
  const mockSendUpgradeRequest = sendUpgradeRequest as jest.MockedFunction<
    typeof sendUpgradeRequest
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const organization = OrganizationFixture();
  const adminOrganization = OrganizationFixture({
    access: ['org:billing'],
  });

  it('renders upgrade now button for admins', function () {
    const subscription = SubscriptionFixture({
      organization,
      canTrial: false,
      canSelfServe: true,
    });

    render(
      <UpgradeOrTrialButton
        api={new MockApiClient()}
        organization={adminOrganization}
        source="test"
        subscription={subscription}
      />
    );

    expect(screen.getByText('Upgrade now')).toBeInTheDocument();
  });

  it('renders request upgrade button for non-admins', function () {
    const subscription = SubscriptionFixture({
      organization,
      canTrial: false,
      canSelfServe: true,
    });

    render(
      <UpgradeOrTrialButton
        api={new MockApiClient()}
        organization={organization}
        source="test"
        subscription={subscription}
      />
    );

    expect(screen.getByText('Request Upgrade')).toBeInTheDocument();
  });

  it('hides button for non-self-serve customers without billing access', function () {
    const subscription = SubscriptionFixture({
      organization,
      canTrial: false,
      canSelfServe: false,
    });

    const {container} = render(
      <UpgradeOrTrialButton
        api={new MockApiClient()}
        organization={organization}
        source="test"
        subscription={subscription}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders start trial button for admins when trial is available', function () {
    const subscription = SubscriptionFixture({
      organization,
      canTrial: true,
      canSelfServe: true,
    });

    render(
      <UpgradeOrTrialButton
        api={new MockApiClient()}
        organization={adminOrganization}
        source="test"
        subscription={subscription}
      />
    );

    expect(screen.getByText(/Start \d+-Day Trial/)).toBeInTheDocument();
  });

  it('renders request trial button for non-admins when trial is available', function () {
    const subscription = SubscriptionFixture({
      organization,
      canTrial: true,
      canSelfServe: true,
    });

    render(
      <UpgradeOrTrialButton
        api={new MockApiClient()}
        organization={organization}
        source="test"
        subscription={subscription}
      />
    );

    expect(screen.getByText('Request Trial')).toBeInTheDocument();
  });

  it('calls sendTrialRequest when request trial button is clicked', async function () {
    const subscription = SubscriptionFixture({
      organization,
      canTrial: true,
      canSelfServe: true,
    });

    render(
      <UpgradeOrTrialButton
        api={new MockApiClient()}
        organization={organization}
        source="test"
        subscription={subscription}
      />
    );

    await userEvent.click(screen.getByText('Request Trial'));

    expect(mockSendTrialRequest).toHaveBeenCalledTimes(1);
    expect(mockSendTrialRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        api: expect.any(Object),
        organization,
      })
    );
  });

  it('calls sendUpgradeRequest when request upgrade button is clicked', async function () {
    const subscription = SubscriptionFixture({
      organization,
      canTrial: false,
      canSelfServe: true,
    });

    render(
      <UpgradeOrTrialButton
        api={new MockApiClient()}
        organization={organization}
        source="test"
        subscription={subscription}
      />
    );

    await userEvent.click(screen.getByText('Request Upgrade'));

    expect(mockSendUpgradeRequest).toHaveBeenCalledTimes(1);
    expect(mockSendUpgradeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        api: expect.any(Object),
        organization,
      })
    );
  });

  it('hides request upgrade button for managed plans', function () {
    const subscription = SubscriptionFixture({
      organization,
      canTrial: false,
      canSelfServe: true,
      isManaged: true,
    });

    const {container} = render(
      <UpgradeOrTrialButton
        api={new MockApiClient()}
        organization={organization}
        source="test"
        subscription={subscription}
      />
    );

    expect(screen.queryByText('Request Upgrade')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
