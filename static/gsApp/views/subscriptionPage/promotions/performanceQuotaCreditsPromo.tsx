import {Fragment} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openPromotionModal} from 'getsentry/actionCreators/modal';
import type {PromotionData} from 'getsentry/types';

type Props = {
  api: Client;
  organization: Organization;
  promotionData: PromotionData;
};

function PromotionModalBody() {
  return (
    <Fragment>
      <h4>{t('Redeem 10M FREE Performance Units')}</h4>
      <p>
        {tct(
          'Congrats. We are giving selected organizations using Performance, a chance to use [units: 10 million Performance Units] now through the end of their next billing cycle for [strong: FREE].',
          {
            units: <strong />,
            strong: <strong />,
          }
        )}
      </p>
      <p>
        {t(
          "Lucky for you and your app's users, your organization made the list. Use the 10 million Performance Units to start monitoring performance for more projects or increase the sample rate of an existing project to know the when and why behind more slowdowns."
        )}
      </p>
    </Fragment>
  );
}

function openPerformanceQuotaCreditsPromoModal({
  api,
  promotionData,
  organization,
}: Props) {
  const promotion = promotionData.availablePromotions?.find(
    promo => promo.promptActivityTrigger === 'performance_quota_credits_v1'
  );

  if (promotion === undefined) {
    return null;
  }

  return openPromotionModal({
    organization,
    price: 0,
    promptFeature: 'performance_quota_credits_v1',
    promotion,
    api,
    acceptButtonText: t('Redeem'),
    declineButtonText: t('Nah, I hate free stuff'),
    PromotionModalBody,
    onAccept: () => {
      addSuccessMessage(t('Redeemed: 10M FREE Performance Units'));
    },
  });
}

export default openPerformanceQuotaCreditsPromoModal;
