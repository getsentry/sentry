import {DiscountInfoFixture} from 'getsentry-test/fixtures/discountInfo';
import {PromotionFixture} from 'getsentry-test/fixtures/promotion';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openPromotionReminderModal} from 'getsentry/actionCreators/modal';
import type {PromotionClaimed} from 'getsentry/types';

describe('Promotion Reminder Modal', function () {
  const cancelFn = jest.fn();

  const promotionClaimed: PromotionClaimed = {
    promotion: PromotionFixture({
      name: 'Test Promotion',
      slug: 'test_promotion',
      showDiscountInfo: true,
      discountInfo: DiscountInfoFixture({
        amount: 2500,
        billingInterval: 'monthly',
        billingPeriods: 3,
        discountType: 'percentPoints',
        disclaimerText:
          "*Receive 40% off the monthly price of Sentry's Team or Business plan subscriptions for your first three months if you upgrade today",
        durationText: 'First three months',
        maxCentsPerPeriod: 10000,
        reminderText:
          'Changing your plan type from Business to Team will cancel your current promotion.',
      }),
    }),
    dateClaimed: '2023-03-01T10:00:00.000Z',
    dateCompleted: '2023-03-01T10:00:00.000Z',
    dateExpired: '2023-03-04T10:00:00.000Z',
    freeEventCreditDaysLeft: 0,
    isLastCycleForFreeEvents: false,
  };

  it('renders promotion reminder modal', async function () {
    openPromotionReminderModal(promotionClaimed, cancelFn);

    renderGlobalModal();

    expect(screen.getByText('Promotion Conflict')).toBeInTheDocument();
    expect(screen.getByText('Current Promotion:')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Changing your plan type from Business to Team will cancel your current promotion.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('25% off (up to $100 per month) for 3 months starting on 3/1/2023')
    ).toBeInTheDocument();

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Downgrade Anyway')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(cancelFn).toHaveBeenCalled();
  });
});
