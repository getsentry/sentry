import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {sendAddEventsRequest, sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import AddEventsCTA from 'getsentry/components/addEventsCTA';
import {PlanTier} from 'getsentry/types';
import {
  getBestActionToIncreaseEventLimits,
  type UsageAction,
} from 'getsentry/utils/billing';
import {openOnDemandBudgetEditModal} from 'getsentry/views/onDemandBudgets/editOnDemandButton';

jest.mock('getsentry/actionCreators/upsell', () => ({
  sendUpgradeRequest: jest.fn(),
  sendAddEventsRequest: jest.fn(),
}));

jest.mock('getsentry/utils/billing', () => {
  const actual = jest.requireActual('getsentry/utils/billing');
  return {
    ...actual,
    displayBudgetName: jest.fn(() => 'On-Demand Budget'),
    getBestActionToIncreaseEventLimits: jest.fn(),
    getTrialLength: jest.fn(),
  };
});

jest.mock('getsentry/views/onDemandBudgets/editOnDemandButton', () => ({
  openOnDemandBudgetEditModal: jest.fn(),
}));

describe('AddEventsCTA', function () {
  const mockSendUpgradeRequest = sendUpgradeRequest as jest.MockedFunction<
    typeof sendUpgradeRequest
  >;
  const _mockSendAddEventsRequest = sendAddEventsRequest as jest.MockedFunction<
    typeof sendAddEventsRequest
  >;
  const mockGetBestActionToIncreaseEventLimits =
    getBestActionToIncreaseEventLimits as jest.MockedFunction<
      typeof getBestActionToIncreaseEventLimits
    >;
  const _mockOpenOnDemandBudgetEditModal =
    openOnDemandBudgetEditModal as jest.MockedFunction<
      typeof openOnDemandBudgetEditModal
    >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    planTier: PlanTier.AM1,
    canSelfServe: true,
    isManaged: false,
  });

  const defaultProps = {
    api: new MockApiClient(),
    organization,
    subscription,
    source: 'test',
    referrer: 'test-referrer',
  };

  it('renders request upgrade button when action is request_upgrade and subscription is self-serve and not managed', function () {
    mockGetBestActionToIncreaseEventLimits.mockReturnValue(
      'request_upgrade' as UsageAction
    );

    render(<AddEventsCTA {...defaultProps} />);

    expect(screen.getByText('Request Upgrade')).toBeInTheDocument();
  });

  it('does not render request upgrade button when action is request_upgrade but subscription is not self-serve', function () {
    mockGetBestActionToIncreaseEventLimits.mockReturnValue(
      'request_upgrade' as UsageAction
    );

    const nonSelfServeSubscription = {
      ...subscription,
      canSelfServe: false,
    };

    const {container} = render(
      <AddEventsCTA {...defaultProps} subscription={nonSelfServeSubscription} />
    );

    expect(screen.queryByText('Request Upgrade')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render request upgrade button when action is request_upgrade but subscription is managed', function () {
    mockGetBestActionToIncreaseEventLimits.mockReturnValue(
      'request_upgrade' as UsageAction
    );

    const managedSubscription = {
      ...subscription,
      isManaged: true,
    };

    const {container} = render(
      <AddEventsCTA {...defaultProps} subscription={managedSubscription} />
    );

    expect(screen.queryByText('Request Upgrade')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('calls sendUpgradeRequest when request upgrade button is clicked', async function () {
    mockGetBestActionToIncreaseEventLimits.mockReturnValue(
      'request_upgrade' as UsageAction
    );

    render(<AddEventsCTA {...defaultProps} />);

    await userEvent.click(screen.getByText('Request Upgrade'));

    expect(mockSendUpgradeRequest).toHaveBeenCalledTimes(1);
    expect(mockSendUpgradeRequest).toHaveBeenCalledWith({
      api: expect.any(Object),
      organization,
    });
  });

  it('renders add events button when action is add_events', function () {
    mockGetBestActionToIncreaseEventLimits.mockReturnValue('add_events' as UsageAction);

    render(<AddEventsCTA {...defaultProps} />);

    expect(screen.getByText(/On-Demand Budget/)).toBeInTheDocument();
  });

  it('renders request additional quota button when action is request_add_events', function () {
    mockGetBestActionToIncreaseEventLimits.mockReturnValue(
      'request_add_events' as UsageAction
    );

    render(<AddEventsCTA {...defaultProps} />);

    expect(screen.getByText('Request Additional Quota')).toBeInTheDocument();
  });

  it('renders start trial button when action is start_trial', function () {
    mockGetBestActionToIncreaseEventLimits.mockReturnValue('start_trial' as UsageAction);

    render(<AddEventsCTA {...defaultProps} />);

    expect(screen.getByText('Start Trial')).toBeInTheDocument();
  });

  it('renders upgrade plan button when action is send_to_checkout', function () {
    mockGetBestActionToIncreaseEventLimits.mockReturnValue(
      'send_to_checkout' as UsageAction
    );

    render(<AddEventsCTA {...defaultProps} />);

    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
  });
});
