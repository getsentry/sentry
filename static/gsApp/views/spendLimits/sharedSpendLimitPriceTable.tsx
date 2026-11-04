import {Fragment} from 'react';
import styled from '@emotion/styled';

import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {capitalize} from 'sentry/utils/string/capitalize';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {AddOnCategory, Plan} from 'getsentry/types';
import {
  displayPrice,
  formatReservedWithUnits,
  getReservedBudgetCategoryForAddOn,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  getSingularCategoryName,
} from 'getsentry/utils/dataCategory';
import {PerformanceHovercard} from 'getsentry/views/amCheckout/components/volumeSliders';
import {getProductCheckoutDescription} from 'getsentry/views/amCheckout/steps/productSelect';
import {
  formatPaygPricePerUnit,
  getPaygPricePerUnit,
} from 'getsentry/views/spendLimits/pricingUtils';

interface SharedSpendLimitPriceTableProps {
  activePlan: Plan;
  currentReserved: Partial<Record<DataCategory, number>>;
  includedAddOns: AddOnCategory[];
  organization: Organization;
}

const COLUMNS: TableColumnConfig[] = [
  {key: 'product', width: 'minmax(0, 3fr)'},
  {key: 'price', width: 'minmax(0, 2fr)'},
];

const STACKED_CELL_COLUMN = {zero: '1 / -1', md: 'auto'} as const;

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
    <FlushTable
      aria-label={t('Product prices')}
      columns={COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Product')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right" divider={false}>
            <Container display={{zero: 'none', md: 'block'}}>{t('Price')}</Container>
          </SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {baseCategories.map(category => {
        const showPerformanceUnits =
          activePlan.categories.includes(DataCategory.TRANSACTIONS) &&
          activePlan.categories.includes(DataCategory.PROFILE_DURATION) &&
          organization.features?.includes('profiling-billing') &&
          category === DataCategory.TRANSACTIONS;
        const categoryInfo = getCategoryInfoFromPlural(category);
        const reserved = currentReserved[category] ?? 0;
        const payAsYouGoPricePerUnit = getPaygPricePerUnit({
          activePlan,
          category,
          reserved,
        });
        const hasConstantPricePerUnit = activePlan.planCategories[category]?.length === 1;
        const pluralName = getPlanCategoryName({plan: activePlan, category});
        const singularName =
          categoryInfo?.shortenedUnitName ??
          getSingularCategoryName({plan: activePlan, category, capitalize: false});

        return (
          <SimpleTable.Row key={category}>
            <SimpleTable.RowCell
              column={STACKED_CELL_COLUMN}
              gap="xs"
              paddingBottom={{zero: '0', md: 'lg'}}
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
              {showPerformanceUnits ? (
                <PerformanceHovercard />
              ) : (
                categoryInfo?.checkoutTooltip && (
                  <InfoTip
                    title={categoryInfo.checkoutTooltip}
                    position="top"
                    size="xs"
                  />
                )
              )}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell
              column={STACKED_CELL_COLUMN}
              justify={{zero: 'start', md: 'end'}}
              paddingTop={{zero: 'xs', md: 'lg'}}
            >
              <Container>
                <Text>
                  {hasConstantPricePerUnit ? '' : '*'}
                  {formatPaygPricePerUnit({payAsYouGoPricePerUnit})}
                </Text>
                <Text variant="muted">/{singularName}</Text>
              </Container>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
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
          <SimpleTable.Row key={apiName}>
            <SimpleTable.RowCell
              column={STACKED_CELL_COLUMN}
              gap="xs"
              paddingBottom={{zero: '0', md: 'lg'}}
              wrap="wrap"
            >
              <Text>{capitalize(addOnInfo.productName)}</Text>
              {includedBudget > 0 && (
                <Text variant="accent">
                  {tct(' ([formattedIncludedBudget] included)', {
                    formattedIncludedBudget: displayPrice({cents: includedBudget}),
                  })}
                </Text>
              )}
              {tooltipText && <InfoTip title={tooltipText} position="top" size="xs" />}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell
              column={STACKED_CELL_COLUMN}
              justify={{zero: 'start', md: 'end'}}
              paddingTop={{zero: 'xs', md: 'lg'}}
            >
              <Container>
                {addOnInfo.dataCategories.map((category, index) => {
                  const payAsYouGoPricePerUnit = getPaygPricePerUnit({
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
                      <Text>{formatPaygPricePerUnit({payAsYouGoPricePerUnit})}</Text>
                      <Text variant="muted">/{singularName}</Text>
                      {index < addOnInfo.dataCategories.length - 1 && <Text>, </Text>}
                    </Fragment>
                  );
                })}
              </Container>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
      <SimpleTable.FullWidthRow>
        <Flex justify="end" padding="md xl">
          <Text variant="muted" size="sm">
            {t('* starting rate')}
          </Text>
        </Flex>
      </SimpleTable.FullWidthRow>
    </FlushTable>
  );
}

const FlushTable = styled(SimpleTable)`
  border-width: 1px 0 0;
  border-radius: 0;

  > thead > tr {
    border-radius: 0;
  }
`;
