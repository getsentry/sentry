import {useCallback, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/core/button';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';

import {isDeveloperPlan, isTrialPlan} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import VolumeSliders from 'getsentry/views/amCheckout/components/volumeSliders';
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
    isDeveloperPlan(subscription.planDetails) || isTrialPlan(subscription.plan)
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
    <Stack borderTop="primary">
      <Flex
        gap="md"
        align="center"
        justify="between"
        width="100%"
        background="secondary"
        padding="xl xl"
      >
        <Stack gap="sm" align="start">
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
          <Text variant="muted">
            {t('Prepay for usage by reserving volumes and save up to 20%')}
          </Text>
        </Stack>
        {reservedVolumeTotal > 0 && (
          <Container>
            <Text size={{xs: 'lg', sm: 'xl'}} bold density="compressed">
              +${formatPrice({cents: reservedVolumeTotal})}
            </Text>
            <Text size={{xs: 'sm', sm: 'lg'}} variant="muted">
              /{getShortInterval(activePlan.billingInterval)}
            </Text>
          </Container>
        )}
      </Flex>
      {showSliders && (
        <Stack direction="column" borderTop="primary">
          <Flex borderTop="primary" width="100%" />
          <VolumeSliders
            checkoutTier={checkoutTier}
            activePlan={activePlan}
            organization={organization}
            onUpdate={onUpdate}
            formData={formData}
            subscription={subscription}
            onReservedChange={debouncedReservedChange}
          />
        </Stack>
      )}
    </Stack>
  );
}

export default ReserveAdditionalVolume;
