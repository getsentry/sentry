import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {RecurringCreditFixture} from 'getsentry-test/fixtures/recurringCredit';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {CreditType, type Plan} from 'getsentry/types';
import RecurringCredits from 'getsentry/views/subscriptionPage/recurringCredits';

describe('Recurring Credits', function () {
  const organization = OrganizationFixture({features: [], access: ['org:billing']});
  const subscription = SubscriptionFixture({organization});

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders error recurring credits', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [
        RecurringCreditFixture(),
        RecurringCreditFixture({
          id: 1,
          periodStart: moment().format(),
          periodEnd: moment().utc().add(3, 'months').format(),
          amount: 1500,
          type: CreditType.DISCOUNT,
          totalAmountRemaining: 7500,
        }),
      ],
    });

    render(
      <RecurringCredits displayType="data" planDetails={subscription.planDetails} />,
      {organization}
    );

    await screen.findByRole('heading', {name: /recurring credits/i});

    expect(screen.getByText('errors')).toBeInTheDocument();
    expect(screen.getByTestId('amount')).toHaveTextContent('+50K/mo');
  });

  it('renders transaction recurring credits', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [
        RecurringCreditFixture({
          id: 1,
          periodStart: moment().format(),
          periodEnd: moment().utc().add(3, 'months').format(),
          amount: 100_000,
          type: CreditType.TRANSACTION,
          totalAmountRemaining: null,
        }),
      ],
    });

    render(
      <RecurringCredits displayType="data" planDetails={subscription.planDetails} />,
      {organization}
    );

    await screen.findByRole('heading', {name: /recurring credits/i});

    expect(screen.getByText('transactions')).toBeInTheDocument();
    expect(screen.getByTestId('amount')).toHaveTextContent('+100K/mo');
  });

  it('renders profile duration recurring credits', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [
        RecurringCreditFixture({
          id: 1,
          periodStart: moment().format(),
          periodEnd: moment().utc().add(3, 'months').format(),
          amount: 10,
          type: CreditType.PROFILE_DURATION,
          totalAmountRemaining: null,
        }),
      ],
    });

    const planDetails: Plan = {
      ...subscription.planDetails,
      categoryDisplayNames: {
        ...subscription.planDetails.categoryDisplayNames,
        [DataCategory.PROFILE_DURATION]: {
          singular: 'profile hour',
          plural: 'profile hours',
        },
      },
    };

    render(<RecurringCredits displayType="data" planDetails={planDetails} />, {
      organization,
    });

    await screen.findByRole('heading', {name: /recurring credits/i});

    expect(screen.getByText('profile hours')).toBeInTheDocument();
    expect(screen.getByTestId('amount')).toHaveTextContent('+10/mo');
  });

  it('renders attachment recurring credits', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [
        RecurringCreditFixture({
          id: 1,
          periodStart: moment().format(),
          periodEnd: moment().utc().add(3, 'months').format(),
          amount: 1.5,
          type: CreditType.ATTACHMENT,
          totalAmountRemaining: null,
        }),
      ],
    });

    render(
      <RecurringCredits displayType="data" planDetails={subscription.planDetails} />,
      {organization}
    );

    await screen.findByRole('heading', {name: /recurring credits/i});

    expect(screen.getByText('attachments')).toBeInTheDocument();
    expect(screen.getByTestId('amount')).toHaveTextContent('+1.5 GB/mo');
  });

  it('renders replay recurring credits', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [
        RecurringCreditFixture({
          id: 1,
          periodStart: moment().format(),
          periodEnd: moment().utc().add(3, 'months').format(),
          amount: 3_000_000,
          type: CreditType.REPLAY,
          totalAmountRemaining: null,
        }),
      ],
    });

    render(
      <RecurringCredits displayType="data" planDetails={subscription.planDetails} />,
      {organization}
    );

    await screen.findByRole('heading', {name: /recurring credits/i});

    expect(screen.getByText('replays')).toBeInTheDocument();
    expect(screen.getByTestId('amount')).toHaveTextContent('+3M/mo');
  });

  it('renders multiple recurring credits', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [
        RecurringCreditFixture({
          id: 1,
          periodStart: moment().format(),
          periodEnd: '2021-12-01',
          amount: 50000,
          type: CreditType.ERROR,
          totalAmountRemaining: null,
        }),
        RecurringCreditFixture({
          id: 1,
          periodStart: moment().format(),
          periodEnd: '2022-01-01',
          amount: 100000,
          type: CreditType.ERROR,
          totalAmountRemaining: null,
        }),
      ],
    });

    render(
      <RecurringCredits displayType="data" planDetails={subscription.planDetails} />,
      {organization}
    );

    await screen.findByRole('heading', {name: /recurring credits/i});

    expect(screen.getAllByText('errors')).toHaveLength(2);

    const amounts = screen.getAllByTestId('amount');
    const endDates = screen.getAllByTestId('end-date');

    expect(amounts[0]).toHaveTextContent('+50K/mo');
    expect(endDates[0]).toHaveTextContent('Dec 1, 2021');

    expect(amounts[1]).toHaveTextContent('+100K/mo');
    expect(endDates[1]).toHaveTextContent('Jan 1, 2022');
  });

  it('renders discount', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [
        RecurringCreditFixture(),
        RecurringCreditFixture({
          id: 1,
          periodStart: moment().format(),
          periodEnd: moment().utc().add(3, 'months').format(),
          amount: 1500,
          type: CreditType.DISCOUNT,
          totalAmountRemaining: 7500,
        }),
      ],
    });

    render(
      <RecurringCredits displayType="discount" planDetails={subscription.planDetails} />,
      {organization}
    );

    await screen.findByRole('heading', {name: /recurring credits/i});

    expect(screen.getByText('discount')).toBeInTheDocument();
    expect(screen.getByTestId('amount')).toHaveTextContent('$15/mo');
  });
});
