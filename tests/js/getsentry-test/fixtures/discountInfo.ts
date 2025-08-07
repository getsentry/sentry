import type {DiscountInfo as TDiscountInfo} from 'getsentry/types';

type Props = Partial<TDiscountInfo>;

export function DiscountInfoFixture(props: Props): TDiscountInfo {
  return {
    amount: 0,
    billingInterval: 'monthly',
    billingPeriods: 1,
    creditCategory: null,
    disclaimerText: '',
    discountType: 'events',
    durationText: 'Monthly',
    maxCentsPerPeriod: 0,
    modalDisclaimerText: '',
    planRequirement: null,
    reminderText: '',
    ...props,
  };
}
