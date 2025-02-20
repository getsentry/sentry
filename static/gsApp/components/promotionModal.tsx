import type {ComponentType} from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HighlightModalContainer from 'sentry/components/highlightModalContainer';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {OrganizationContext} from 'sentry/views/organizationContext';

import type {Promotion, PromotionData} from 'getsentry/types';
import {claimAvailablePromotion} from 'getsentry/utils/promotionUtils';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import withPromotions from 'getsentry/utils/withPromotions';

import PromotionPriceDisplay from './promotionPriceDisplay';

interface PromotionModalProps extends Pick<ModalRenderProps, 'closeModal'> {
  organization: Organization;
  price: number;
  promotion: Promotion;
  promotionData: PromotionData;
  promptFeature: string;
  PromotionModalBody?: ComponentType<PromotionModalBodyProps>;
  acceptButtonText?: string;
  declineButtonText?: string;
  onAccept?: () => void;
}

type PriceProps = {
  maxDiscount: number;
  percentOff: number;
  price: number;
  promoPrice?: boolean;
};

function calculatePrice({
  price,
  percentOff,
  maxDiscount,
  promoPrice = false,
}: PriceProps) {
  const discount = promoPrice ? Math.min(price * (percentOff / 100), maxDiscount) : 0;
  return (price - discount) / 100;
}

export type PromotionModalBodyProps = {
  promotion: Promotion;
};

type DefaultDiscountBodyProps = PromotionModalBodyProps & {
  price: number;
};

function DefaultDiscountBody({promotion, price}: DefaultDiscountBodyProps) {
  const {amount, billingInterval, billingPeriods, maxCentsPerPeriod} =
    promotion.discountInfo;

  const interval = billingInterval === 'monthly' ? 'months' : 'years';
  const intervalSingular = interval.slice(0, -1);
  const percentOff = amount / 100;

  return (
    <Fragment>
      <h4>
        Get {percentOff}% off for the next {billingPeriods} {interval}*
      </h4>
      <p>
        Receive a {percentOff}% discount for the next {billingPeriods} {interval} for your
        total {billingInterval} bill up to ${maxCentsPerPeriod / 100} per{' '}
        {intervalSingular}.
      </p>
      <PromotionPriceComparison>
        <PromotionPriceDisplay
          price={calculatePrice({
            price,
            percentOff,
            maxDiscount: maxCentsPerPeriod,
          })}
          title="Current Price"
        />
        <IconArrow direction="right" size="lg" />
        <PromotionPriceDisplay
          price={calculatePrice({
            price,
            percentOff,
            maxDiscount: maxCentsPerPeriod,
            promoPrice: true,
          })}
          title="Promo Price"
          promo
        />
      </PromotionPriceComparison>
    </Fragment>
  );
}

const PromotionModal = withPromotions(
  (
    props: PromotionModalProps & {
      promotionData: PromotionData;
    }
  ) => {
    const api = useApi();
    const {
      price,
      promotionData,
      promotion,
      organization,
      acceptButtonText,
      declineButtonText,
      closeModal,
      onAccept,
      PromotionModalBody,
      promptFeature,
    } = props;

    const {name} = promotion;
    const {modalDisclaimerText} = promotion.discountInfo;
    const acceptText = acceptButtonText ?? t("Let's do it");
    const declineText = declineButtonText ?? t('Nah, I hate savings');
    const modalBody = PromotionModalBody ? (
      <PromotionModalBody promotion={promotion} />
    ) : (
      <DefaultDiscountBody promotion={promotion} price={price} />
    );

    async function handleClick() {
      closeModal();

      await claimAvailablePromotion({
        promotionData,
        organization,
        promptFeature,
      });

      onAccept?.();

      trackGetsentryAnalytics('growth.promo_modal_accept', {
        organization,
        promo: name,
      });
    }

    /**
     * Removed translation because of complicated pluralization and lots of changing
     * parameters from the different promotions we can use this for
     */

    return (
      <HighlightModalContainer topWidth="200px" bottomWidth="150px">
        <Subheader>{t('Limited Time Offer')}</Subheader>
        {modalBody}
        <StyledButtonBar gap={1}>
          <Button size="md" priority="primary" onClick={() => handleClick()}>
            {acceptText}
          </Button>
          <Button
            size="md"
            onClick={async () => {
              closeModal();
              trackGetsentryAnalytics('growth.promo_modal_decline', {
                organization,
                promo: name,
              });

              try {
                await api.requestPromise(
                  `/organizations/${organization.slug}/promotions/${promotion.slug}/decline/`,
                  {
                    method: 'POST',
                  }
                );
              } catch (err) {
                Sentry.captureException(err);
              }
            }}
          >
            {declineText}
          </Button>
        </StyledButtonBar>
        <DisclaimerText>{modalDisclaimerText}</DisclaimerText>
      </HighlightModalContainer>
    );
  }
);

function PromotionModalWrapper(props: Omit<PromotionModalProps, 'promotionData'>) {
  // provide org context so we can use withPromotions
  return (
    <OrganizationContext.Provider value={props.organization}>
      <PromotionModal {...props} />
    </OrganizationContext.Provider>
  );
}

export default PromotionModalWrapper;

const Subheader = styled('div')`
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(1)};
`;

const DisclaimerText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray400};
  margin-top: ${space(1)};
`;

const PromotionPriceComparison = styled('div')`
  display: flex;
  gap: ${space(2)};
  align-items: center;
`;
const StyledButtonBar = styled(ButtonBar)`
  max-width: 150px;
  margin-top: ${space(2)};
`;

export const modalCss = css`
  width: 100%;
  max-width: 500px;

  [role='document'] {
    position: relative;
    padding: 50px 50px;
  }
`;
