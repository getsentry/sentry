import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {PlanTier} from 'getsentry/types';
import {isAmPlan} from 'getsentry/utils/billing';
import VolumeSliders from 'getsentry/views/amCheckout/steps/volumeSliders';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import {formatPrice, getShortInterval} from 'getsentry/views/amCheckout/utils';

function ReserveAdditionalVolume({
  organization,
  subscription,
  activePlan,
  checkoutTier,
  formData,
  onUpdate,
}: Pick<
  StepProps,
  | 'organization'
  | 'subscription'
  | 'activePlan'
  | 'checkoutTier'
  | 'formData'
  | 'onUpdate'
>) {
  const [showSliders, setShowSliders] = useState(false);
  const reservedVolumeTotal = useMemo(() => {
    return Object.entries(formData.reserved).reduce((acc, [category, value]) => {
      const bucket = activePlan.planCategories?.[category as DataCategory]?.find(
        b => b.events === value
      );
      return acc + (bucket?.price ?? 0);
    }, 0);
  }, [formData.reserved, activePlan]);

  // TODO(checkout v3): correct math
  const savings = useMemo(() => {
    return reservedVolumeTotal * 1.2 - reservedVolumeTotal;
  }, [reservedVolumeTotal]);

  const isLegacy =
    !checkoutTier ||
    !isAmPlan(checkoutTier) ||
    [PlanTier.AM2, PlanTier.AM1].includes(checkoutTier ?? PlanTier.AM3);

  return (
    <ReserveAdditionalVolumeContainer>
      <Flex justify="between">
        <Flex direction="column" gap="md" align="start">
          <RowWithTag>
            <Title>{t('Reserve additional volume')}</Title>
            <Tag type="promotion">{t('save 20%')}</Tag>
          </RowWithTag>
          <Description>
            {t('Plan ahead of time by reserving extra volume, and get more for less')}
          </Description>
        </Flex>
        <Flex gap="md" align="center">
          {reservedVolumeTotal > 0 && !showSliders && (
            <div>
              <Price>${formatPrice({cents: reservedVolumeTotal})}</Price>
              <BillingInterval>
                /{getShortInterval(activePlan.billingInterval)}
              </BillingInterval>
            </div>
          )}
          <Button
            icon={<IconChevron direction={showSliders ? 'up' : 'down'} />}
            aria-label={
              showSliders
                ? t('Hide reserved volume sliders')
                : t('Show reserved volume sliders')
            }
            onClick={() => setShowSliders(!showSliders)}
          />
        </Flex>
      </Flex>
      {showSliders && (
        <Fragment>
          <Separator />
          <VolumeSliders
            checkoutTier={checkoutTier}
            activePlan={activePlan}
            organization={organization}
            onUpdate={onUpdate}
            formData={formData}
            subscription={subscription}
            isLegacy={isLegacy}
            isNewCheckout
          />
          {reservedVolumeTotal > 0 && (
            <TotalContainer justify="between" align="center">
              <Total>{t('Total')}</Total>
              <Flex direction="column" align="end">
                <div>
                  <Price>${formatPrice({cents: reservedVolumeTotal})}</Price>
                  <BillingInterval>
                    /{getShortInterval(activePlan.billingInterval)}
                  </BillingInterval>
                </div>
                <Savings>
                  {tct('Save $[savings] vs. [budgetTerm]', {
                    savings: formatPrice({cents: savings}),
                    budgetTerm: activePlan.budgetTerm,
                  })}
                </Savings>
              </Flex>
            </TotalContainer>
          )}
        </Fragment>
      )}
    </ReserveAdditionalVolumeContainer>
  );
}

export default ReserveAdditionalVolume;

const ReserveAdditionalVolumeContainer = styled(Container)`
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;

const RowWithTag = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const Title = styled('label')`
  font-weight: 600;
  margin: 0;
  line-height: normal;
  font-size: ${p => p.theme.fontSize.lg};
`;

const Price = styled('span')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.activeText};
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  margin: 0;
`;

const BillingInterval = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
`;

const Separator = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: ${p => p.theme.space.md} 0;
`;

const TotalContainer = styled(Flex)`
  background: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.lg};
  border-radius: ${p => p.theme.borderRadius};
`;

const Total = styled('span')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Savings = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
`;
