import {Fragment} from 'react';

import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {capitalize} from 'sentry/utils/string/capitalize';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {AddOnCategory, Plan} from 'getsentry/types';
import {
  formatReservedWithUnits,
  getReservedBudgetCategoryForAddOn,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  getSingularCategoryName,
} from 'getsentry/utils/dataCategory';
import {renderPerformanceHovercard} from 'getsentry/views/amCheckout/components/volumeSliders';
import {getProductCheckoutDescription} from 'getsentry/views/amCheckout/steps/productSelect';
import {displayPrice} from 'getsentry/views/amCheckout/utils';
import {
  formatPaygPricePerUnit,
  getPaygPpe,
} from 'getsentry/views/spendLimits/pricingUtils';

interface SharedSpendLimitPriceTableProps {
  activePlan: Plan;
  currentReserved: Partial<Record<DataCategory, number>>;
  includedAddOns: AddOnCategory[];
  organization: Organization;
}

const PRICE_COLUMNS = {
  zero: 'minmax(0, 1fr)',
  md: 'minmax(0, 3fr) minmax(0, 2fr)',
} as const;

export function SharedSpendLimitPriceTable({
  activePlan,
  currentReserved,
  organization,
  includedAddOns,
}: SharedSpendLimitPriceTableProps) {
  const addOnDataCategories = Object.values(activePlan.addOnCategories).flatMap(
    addOnInfo => addOnInfo.dataCategories
  );
  const baseCategories = activePlan.onDemandCategories.filter(
    category => !addOnDataCategories.includes(category)
  );

  return (
    <Stack borderTop="primary">
      <Grid
        columns={PRICE_COLUMNS}
        gap={{zero: 'xs', md: 'lg'}}
        align="center"
        padding="md xl"
        background="secondary"
      >
        <Text bold>{t('Product')}</Text>
        <Container display={{zero: 'none', md: 'block'}} justifySelf="end">
          <Text bold>{t('Price')}</Text>
        </Container>
      </Grid>
      {baseCategories.map(category => {
        const showPerformanceUnits =
          activePlan.categories.includes(DataCategory.TRANSACTIONS) &&
          activePlan.categories.includes(DataCategory.PROFILE_DURATION) &&
          organization.features?.includes('profiling-billing') &&
          category === DataCategory.TRANSACTIONS;
        const categoryInfo = getCategoryInfoFromPlural(category);
        const reserved = currentReserved[category] ?? 0;
        const paygPpe = getPaygPpe({activePlan, category, reserved});
        const hasConstantPpe = activePlan.planCategories[category]?.length === 1;
        const pluralName = getPlanCategoryName({plan: activePlan, category});
        const singularName =
          categoryInfo?.shortenedUnitName ??
          getSingularCategoryName({plan: activePlan, category, capitalize: false});

        return (
          <Grid
            key={category}
            columns={PRICE_COLUMNS}
            gap={{zero: 'xs', md: 'lg'}}
            align="center"
            borderTop="primary"
            padding="md xl"
          >
            <Flex
              gap="xs"
              align="center"
              minWidth="0"
              paddingRight="xs"
              wrap={{zero: 'wrap', sm: 'nowrap'}}
            >
              <Text>{pluralName}</Text>
              {reserved > 0 && (
                <Text variant="accent">
                  {tct('([formattedReserved] included)', {
                    formattedReserved: formatReservedWithUnits(reserved, category, {
                      isAbbreviated: true,
                    }),
                  })}
                </Text>
              )}
              {showPerformanceUnits
                ? renderPerformanceHovercard()
                : categoryInfo?.checkoutTooltip && (
                    <InfoTip
                      title={categoryInfo.checkoutTooltip}
                      position="top"
                      size="xs"
                    />
                  )}
            </Flex>
            <Container justifySelf={{zero: 'start', md: 'end'}}>
              <Text>
                {hasConstantPpe ? '' : '*'}
                {formatPaygPricePerUnit({paygPpe})}
              </Text>
              <Text variant="muted">/{singularName}</Text>
            </Container>
          </Grid>
        );
      })}
      {includedAddOns.map(apiName => {
        const addOnInfo = activePlan.addOnCategories[apiName];
        if (
          !addOnInfo ||
          !addOnInfo.dataCategories.some(category =>
            activePlan.onDemandCategories.includes(category)
          )
        ) {
          return null;
        }

        const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(apiName);
        const includedBudget = reservedBudgetCategory
          ? (activePlan.availableReservedBudgetTypes[reservedBudgetCategory]
              ?.defaultBudget ?? 0)
          : 0;
        const tooltipText = getProductCheckoutDescription({
          product: apiName,
          withPunctuation: true,
        });

        return (
          <Grid
            key={apiName}
            columns={PRICE_COLUMNS}
            gap={{zero: 'xs', md: 'lg'}}
            align="center"
            borderTop="primary"
            padding="md xl"
          >
            <Flex gap="xs" align="center" minWidth="0" paddingRight="xs" wrap="wrap">
              <Text>{capitalize(addOnInfo.productName)}</Text>
              {includedBudget > 0 && (
                <Text variant="accent">
                  {tct(' ([formattedIncludedBudget] included)', {
                    formattedIncludedBudget: displayPrice({cents: includedBudget}),
                  })}
                </Text>
              )}
              {tooltipText && <InfoTip title={tooltipText} position="top" size="xs" />}
            </Flex>
            <Container justifySelf={{zero: 'start', md: 'end'}}>
              {addOnInfo.dataCategories.map((category, index) => {
                const paygPpe = getPaygPpe({
                  activePlan,
                  category,
                  reserved: reservedBudgetCategory ? RESERVED_BUDGET_QUOTA : 0,
                });
                const categoryInfo = getCategoryInfoFromPlural(category);
                const singularName =
                  categoryInfo?.shortenedUnitName ??
                  getSingularCategoryName({
                    plan: activePlan,
                    category,
                    capitalize: false,
                  });
                return (
                  <Fragment key={category}>
                    <Text>{formatPaygPricePerUnit({paygPpe})}</Text>
                    <Text variant="muted">/{singularName}</Text>
                    {index < addOnInfo.dataCategories.length - 1 && <Text>, </Text>}
                  </Fragment>
                );
              })}
            </Container>
          </Grid>
        );
      })}
      <Flex width="100%" justify="end" borderTop="primary" padding="md xl">
        <Text variant="muted" size="sm">
          {t('* starting rate')}
        </Text>
      </Flex>
    </Stack>
  );
}
