import {useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HighlightModalContainer from 'sentry/components/highlightModalContainer';
import {IconArrow, IconCodecov} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import PromotionPriceDisplay from 'getsentry/components/promotionPriceDisplay';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {getCodecovJwtLink, useCodecovJwt} from 'getsentry/utils/useCodecovJwt';

interface Props extends ModalRenderProps {
  organization: Organization;
  subscription: Subscription;
  onAccept?: () => void;
}

function CodecovPromotionModal(props: Props) {
  const {organization, closeModal, subscription} = props;
  const {data: jwtData, isPending} = useCodecovJwt(organization.slug);

  const codecovLink = getCodecovJwtLink('sentry-app-subscription-overview', jwtData);

  useEffect(() => {
    trackGetsentryAnalytics('growth.codecov_promotion_opened', {
      organization,
      subscription,
    });
  }, [organization, subscription]);

  return (
    <HighlightModalContainer topWidth="200px" bottomWidth="150px">
      <InnerContent>
        <Subheader>
          <IconCodecov />
          {t('Codecov + Sentry Limited time offer')}
        </Subheader>
        <AddCodeCoveragerHeader>{t('Try Code Coverage')}</AddCodeCoveragerHeader>
        <p>
          {t(
            'Find untested code causing errors and avoid similar errors in the future with Sentry and Codecov.*'
          )}
        </p>
        <PromotionPriceComparison>
          <PromotionPriceDisplay price={60} title="Current Price" showDecimals={false} />
          <OffsetIconArrow direction="right" size="lg" />
          <PriceWrapper>
            <PromotionPriceDisplay
              price={29}
              title="Starts At*"
              promo
              showDecimals={false}
            />
            <SeatText>{t('Includes 5 seats')}</SeatText>
          </PriceWrapper>
        </PromotionPriceComparison>

        <StyledButtonBar gap={1}>
          <Button
            size="md"
            priority="primary"
            disabled={isPending || !codecovLink}
            onClick={() => {
              if (!codecovLink) {
                return;
              }
              trackGetsentryAnalytics('growth.codecov_promotion_accept', {
                organization,
                subscription,
              });
              window.location.assign(codecovLink);
            }}
          >
            {t('Start 14-day Free Trial')}
          </Button>
          <Button
            data-test-id="maybe-later"
            priority="default"
            onClick={() => {
              trackGetsentryAnalytics('growth.codecov_promotion_decline', {
                organization,
                subscription,
              });
              closeModal();
            }}
          >
            {t('Maybe Later')}
          </Button>
        </StyledButtonBar>
        <DisclaimerText>
          {t(
            '* See code coverage in stack traces with the Sentry GitHub Integration available on a Team or Business plan.'
          )}
        </DisclaimerText>
      </InnerContent>
    </HighlightModalContainer>
  );
}

export default withSubscription(CodecovPromotionModal);

const Subheader = styled('div')`
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeMedium};
  gap: ${space(0.5)};
  display: flex;
  justify-content: flex-start;
  margin-bottom: ${space(1)};
`;

const DisclaimerText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray400};
  margin-top: ${space(1)};
`;

const PromotionPriceComparison = styled('div')`
  display: flex;
  gap: ${space(2)};
`;
const StyledButtonBar = styled(ButtonBar)`
  max-width: 150px;
  margin-top: ${space(2)};
`;

const InnerContent = styled('div')`
  padding: 20px 30px 20px;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const PriceWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const SeatText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const OffsetIconArrow = styled(IconArrow)`
  margin-top: 28px;
`;

const AddCodeCoveragerHeader = styled('h4')`
  margin-bottom: 12px;
`;

export const modalCss = css`
  width: 100%;
  max-width: 540px;

  [role='document'] {
    position: relative;
  }
`;
