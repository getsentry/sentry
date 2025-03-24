import {OrganizationFixture} from 'sentry-fixture/organization';

import {DiscountInfoFixture} from 'getsentry-test/fixtures/discountInfo';
import {PromotionFixture} from 'getsentry-test/fixtures/promotion';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PromotionModal from 'getsentry/components/promotionModal';

describe('Promotion Modal', function () {
  const organization = OrganizationFixture();

  const acceptFn = jest.fn();
  const closeModal = jest.fn();

  const promotion = PromotionFixture({
    name: 'Test Promotion',
    slug: 'test_promotion',
    timeLimit: '',
    startDate: '',
    endDate: '',
    showDiscountInfo: true,
    discountInfo: DiscountInfoFixture({
      amount: 2500,
      billingInterval: 'monthly',
      billingPeriods: 3,
      creditCategory: 'subscription',
      discountType: 'percentPoints',
      disclaimerText:
        "*Receive 40% off the monthly price of Sentry's Team or Business plan subscriptions for your first three months if you upgrade today",
      durationText: 'First three months',
      maxCentsPerPeriod: 10000,
      modalDisclaimerText: '*Discount applies only to monthly Sentry Business Plans',
    }),
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders modal', async function () {
    MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/test_promotion/claim/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/test_promotion/decline/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <PromotionModal
        organization={organization}
        promotion={promotion}
        price={2900}
        onAccept={() => acceptFn()}
        closeModal={closeModal}
        promptFeature=""
      />
    );

    expect(screen.getByText('Limited Time Offer')).toBeInTheDocument();
    expect(screen.getByText('Get 25% off for the next 3 months*')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Receive a 25% discount for the next 3 months for your total monthly bill up to $100 per month.'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText('*Discount applies only to monthly Sentry Business Plans')
    ).toBeInTheDocument();

    expect(screen.getByText('29.00')).toBeInTheDocument();
    expect(screen.getByText('21.75')).toBeInTheDocument();

    expect(screen.getByText("Let's do it")).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: "Let's do it"}));

    await waitFor(() => {
      expect(acceptFn).toHaveBeenCalled();
    });
    expect(closeModal).toHaveBeenCalled();

    expect(screen.getByText('Nah, I hate savings')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Nah, I hate savings'}));

    await waitFor(() => {
      expect(closeModal).toHaveBeenCalled();
    });
  });

  it('caps discount as max amount', function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <PromotionModal
        organization={organization}
        promotion={promotion}
        price={100000}
        onAccept={() => acceptFn()}
        closeModal={jest.fn()}
        promptFeature=""
      />
    );

    expect(screen.getByText('1000.00')).toBeInTheDocument();
    expect(screen.getByText('900.00')).toBeInTheDocument();
  });
});
