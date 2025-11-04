import {useCallback, useEffect, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {Tooltip} from '@sentry/scraps/tooltip';

import {Button} from 'sentry/components/core/button';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconAdd, IconSubtract, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import {PlanTier, type Plan} from 'getsentry/types';
import {isAmPlan, isDeveloperPlan} from 'getsentry/utils/billing';
import {getSingularCategoryName, listDisplayNames} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import VolumeSliders from 'getsentry/views/amCheckout/steps/volumeSliders';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import {
  displayUnitPrice,
  formatPrice,
  getBucket,
  getShortInterval,
} from 'getsentry/views/amCheckout/utils';

function ReserveAdditionalVolume({
  organization,
  subscription,
  activePlan,
  checkoutTier,
  formData,
  onUpdate,
  billingConfig,
}: Pick<
  StepProps,
  | 'organization'
  | 'subscription'
  | 'activePlan'
  | 'checkoutTier'
  | 'formData'
  | 'onUpdate'
  | 'billingConfig'
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
  const [perPlanPriceDiffs, setPerPlanPriceDiffs] = useState<
    Record<Plan['id'], Partial<Record<DataCategory, number>> & {plan: Plan}>
  >({});
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

  const planOptions = useMemo(() => {
    // TODO(isabella): Remove this once Developer is surfaced; should this be bubbled up to the
    // parent component now that we use it in multiple child components?
    const plans = billingConfig.planList.filter(
      ({contractInterval, id}) =>
        contractInterval === activePlan.contractInterval && id !== billingConfig.freePlan
    );

    if (plans.length === 0) {
      throw new Error('Cannot get plan options');
    }

    // sort by price ascending
    return plans.sort((a, b) => a.basePrice - b.basePrice);
  }, [billingConfig, activePlan.contractInterval]);

  useEffect(() => {
    setPerPlanPriceDiffs({});
    planOptions.forEach((planOption, index) => {
      const priorPlan = index > 0 ? planOptions[index - 1] : null;
      if (priorPlan && priorPlan?.basePrice > 0) {
        setPerPlanPriceDiffs(
          (
            prev: Record<Plan['id'], Partial<Record<DataCategory, number>> & {plan: Plan}>
          ) => ({
            ...prev,
            [planOption.id]: {
              plan: planOption,
              ...Object.entries(planOption.planCategories ?? {}).reduce(
                (acc, [category, eventBuckets]) => {
                  const priorPlanEventBuckets =
                    priorPlan?.planCategories[category as DataCategory];
                  const currentStartingPrice = eventBuckets[1]?.onDemandPrice ?? 0;
                  const priorStartingPrice =
                    priorPlanEventBuckets?.[1]?.onDemandPrice ?? 0;
                  const perUnitPriceDiff = currentStartingPrice - priorStartingPrice;
                  if (perUnitPriceDiff > 0) {
                    acc[category as DataCategory] = perUnitPriceDiff;
                  }
                  return acc;
                },
                {} as Partial<Record<DataCategory, number>>
              ),
            },
          })
        );
      }
    });
  }, [planOptions, setPerPlanPriceDiffs]);

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
            isLegacy={isLegacy}
            isNewCheckout
            onReservedChange={debouncedReservedChange}
          />
          {Object.entries(perPlanPriceDiffs).map(([planId, info]) => {
            const {plan, ...priceDiffs} = info;
            const planName = plan.name;

            return (
              <Container padding="xl" key={planId}>
                <Tooltip
                  title={tct('Starting at [priceDiffs] more on [planName]', {
                    priceDiffs: oxfordizeArray(
                      Object.entries(priceDiffs).map(([category, diff]) => {
                        const formattedDiff = displayUnitPrice({cents: diff});
                        const formattedCategory = getSingularCategoryName({
                          plan,
                          category: category as DataCategory,
                          capitalize: false,
                        });
                        return `+${formattedDiff} / ${formattedCategory}`;
                      })
                    ),
                    planName,
                  })}
                >
                  <Flex gap="sm">
                    <IconWarning size="sm" color="disabled" />
                    <Text size="sm" variant="muted">
                      {tct('Excess usage for [categories] costs more on [planName]', {
                        categories: listDisplayNames({
                          plan,
                          categories: Object.keys(priceDiffs) as DataCategory[],
                          shouldTitleCase: true,
                        }),
                        planName,
                      })}
                    </Text>
                  </Flex>
                </Tooltip>
              </Container>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default ReserveAdditionalVolume;
