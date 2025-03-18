import {Fragment} from 'react';

import type {Client} from 'sentry/api';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';

import {openPromotionModal} from 'getsentry/actionCreators/modal';
import type {PromotionData} from 'getsentry/types';

type Props = {
  api: Client;
  organization: Organization;
  promotionData: PromotionData;
  promptFeature:
    | 'performance_reserved_txns_discount'
    | 'performance_reserved_txns_discount_v1';
};

function PromotionModalBody() {
  const supportMail = ConfigStore.get('supportEmail');

  return (
    <Fragment>
      <h4>{t('Get 25% off on Reserved Performance Units')}</h4>
      <p>
        {tct(
          "While your organization's 10M free Performance Units promotional gift has expired, if you [firstStrong:purchase additonal Reserved Performance Units in the next two weeks, you'll save 25%] on the cost of total Reserved Performance Units [secondStrong:for the next three months, up to $300.]",
          {
            firstStrong: <strong />,
            secondStrong: <strong />,
          }
        )}
      </p>
      <p>
        {tct(
          'If you have any questions or feedback on Performance, please contact [supportEmail] or schedule a meeting directly with a Sentry Product Manager [managerEmail: here].',
          {
            supportEmail: <a href={'mailto:' + supportMail}>{supportMail}</a>,
            managerEmail: (
              <ExternalLink href="https://calendar.app.google/fmQVfzrb8QafukaD8" />
            ),
          }
        )}
      </p>
    </Fragment>
  );
}

function openPerformanceReservedTransactionsDiscountModal({
  api,
  promotionData,
  organization,
  promptFeature,
}: Props) {
  const activePromotion = promotionData.activePromotions?.find(
    promo =>
      promo.promotion.promptActivityTrigger === 'performance_reserved_txns_discount_v1'
  );

  // Promotion isn't instantly marked as complete when condition is met.
  // I've seen a state where a promotion is briefly active and available,
  // triggering the promotion modal to open, even though the user has already interacted with it once.
  // We want to avoid this since it leads to multiple recurring credits being generated for the same promo.
  if (activePromotion) {
    return null;
  }

  const availablePromotion = promotionData.availablePromotions?.find(
    promo => promo.promptActivityTrigger === 'performance_reserved_txns_discount_v1'
  );

  if (availablePromotion === undefined) {
    return null;
  }

  return openPromotionModal({
    organization,
    price: 0,
    promptFeature,
    promotion: availablePromotion,
    api,
    PromotionModalBody,
    onAccept: () => {
      browserHistory.push({
        pathname: `/settings/billing/checkout/`,
        query: {
          skipBundles: true,
        },
      });
    },
  });
}

export default openPerformanceReservedTransactionsDiscountModal;
