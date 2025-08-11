import {DiscountInfoFixture} from 'getsentry-test/fixtures/discountInfo';

import type {Promotion as TPromotion} from 'getsentry/types';

type Props = Partial<TPromotion>;

export function PromotionFixture(props: Props): TPromotion {
  return {
    autoOptIn: false,
    discountInfo: DiscountInfoFixture({}),
    endDate: '',
    name: 'Lorem Ipsum',
    promptActivityTrigger: null,
    showDiscountInfo: false,
    slug: 'lorem-ipsum',
    startDate: '',
    timeLimit: '',
    ...props,
  };
}
