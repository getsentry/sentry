import {useCallback, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {Separator} from 'sentry/components/core/separator';
import {Text} from 'sentry/components/core/text';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';

import {PlanTier} from 'getsentry/types';
import {isAmPlan, isDeveloperPlan} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import VolumeSliders from 'getsentry/views/amCheckout/steps/volumeSliders';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import {formatPrice, getBucket, getShortInterval} from 'getsentry/views/amCheckout/utils';

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
  // if the customer has any reserved volume above platform already, auto-show the sliders
  const [showSliders, setShowSliders] = useState<boolean>(
    isDeveloperPlan(subscription.planDetails)
      ? false
      : Object.values(subscription.categories ?? {})
          .filter(
            ({category}) =>
              activePlan.checkoutCategories.includes(category) &&
              category in activePlan.planCategories
          )
          .some(
            ({category, reserved}) =>
              getBucket({
                buckets: activePlan.planCategories[category],
                events: reserved ?? 0,
              }).price > 0
          )
  );
  const reservedVolumeTotal = useMemo(() => {
    return Object.entries(formData.reserved).reduce((acc, [category, value]) => {
      const bucket = activePlan.planCategories?.[category as DataCategory]?.find(
        b => b.events === value
      );
      return acc + (bucket?.price ?? 0);
    }, 0);
  }, [formData.reserved, activePlan]);

  const isLegacy =
    !checkoutTier ||
    !isAmPlan(checkoutTier) ||
    [PlanTier.AM2, PlanTier.AM1].includes(checkoutTier ?? PlanTier.AM3);

  const handleReservedChange = useCallback(
    (value: number, category: DataCategory) => {
      onUpdate({reserved: {...formData.reserved, [category]: value}});

      if (organization) {
        trackGetsentryAnalytics('checkout.data_slider_changed', {
          organization,
          data_type: category,
          quantity: value,
        });
      }
    },
    [onUpdate, formData.reserved, organization]
  );

  const debouncedReservedChange = useMemo(
    () =>
      debounce(
        (value: number, category: DataCategory) => handleReservedChange(value, category),
        300
      ),
    [handleReservedChange]
  );

  return (
    <Flex direction="column" gap="md">
      <Flex gap="md" align="center" justify="between" width="100%" height="28px">
        <Flex align="center" gap="md">
          <Button
            size="sm"
            priority="link"
            borderless
            icon={showSliders ? <IconSubtract /> : <IconAdd />}
            aria-label={
              showSliders
                ? t('Hide reserved volume sliders')
                : t('Show reserved volume sliders')
            }
            onClick={() => {
              setShowSliders(!showSliders);
              if (showSliders) {
                trackGetsentryAnalytics('checkout.data_sliders_viewed', {
                  organization,
                  isNewCheckout: true,
                });
              }
            }}
          >
            {t('Reserve additional volume')}
          </Button>
          <Tag type="promotion">{t('save 20%')}</Tag>
        </Flex>
        {reservedVolumeTotal > 0 && (
          <Container>
            <Text size="2xl" bold density="compressed">
              +${formatPrice({cents: reservedVolumeTotal})}
            </Text>
            <Text size="lg" variant="muted">
              /{getShortInterval(activePlan.billingInterval)}
            </Text>
          </Container>
        )}
      </Flex>
      {showSliders && (
        <Flex direction="column" gap="xl">
          <Text variant="muted">
            {t('Prepay for usage by reserving volumes and save up to 20%')}
          </Text>
          <Flex direction="column" gap="md">
            <Separator orientation="horizontal" border="primary" />
            <VolumeSliders
              checkoutTier={checkoutTier}
              activePlan={activePlan}
              organization={organization}
              onUpdate={onUpdate}
              formData={formData}
              subscription={subscription}
              isLegacy={isLegacy}
              isNewCheckout
              onReservedChange={debouncedReservedChange}
            />
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}

export default ReserveAdditionalVolume;
