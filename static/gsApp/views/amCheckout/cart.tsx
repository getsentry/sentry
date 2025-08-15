import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Flex} from 'sentry/components/core/layout';
import Panel from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {Plan, Subscription} from 'getsentry/types';
import {
  formatReservedWithUnits,
  getPlanIcon,
  getProductIcon,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, getSingularCategoryName} from 'getsentry/utils/dataCategory';
import type {CheckoutFormData, SelectableProduct} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

type CartProps = {
  activePlan: Plan;
  formData: CheckoutFormData;
  subscription: Subscription;
  // discountInfo?: Promotion['discountInfo']; // TODO(ISABELLA): Add this back in
};

function Cart({activePlan, formData, subscription}: CartProps) {
  const shortInterval = useMemo(() => {
    return utils.getShortInterval(activePlan.billingInterval);
  }, [activePlan.billingInterval]);

  const budgetCategories = Object.values(activePlan.availableReservedBudgetTypes).reduce(
    (acc, type) => {
      acc.push(...type.dataCategories);
      return acc;
    },
    [] as DataCategory[]
  );

  useEffect(() => {});

  const recurringTotal = utils.getReservedPriceCents({...formData, plan: activePlan});
  const formattedRecurringTotal = utils.displayPrice({cents: recurringTotal});
  const intervalMultiplier = activePlan.billingInterval === 'monthly' ? 1 : 12;
  const maxCostPerInterval =
    (formData.onDemandMaxSpend ?? 0) * intervalMultiplier + recurringTotal;
  const formattedMaxCostPerInterval = utils.displayPrice({cents: maxCostPerInterval});

  return (
    <CartContainer>
      <SummarySection>
        <Title>{t('Plan Summary')}</Title>
        <ItemWithIcon data-test-id="summary-item-plan">
          <IconContainer>{getPlanIcon(activePlan)}</IconContainer>
          <Flex direction="column" gap="xs">
            <Flex justify="between" align="center">
              <strong>{tct('[name] Plan', {name: activePlan.name})}</strong>
              <div>
                {utils.displayPrice({cents: activePlan.totalPrice})}
                {`/${shortInterval}`}
              </div>
            </Flex>
            {activePlan.categories
              .filter(
                category =>
                  !budgetCategories.includes(category) &&
                  (formData.reserved[category] ?? 0) > 0
              )
              .map(category => {
                const reserved = formData.reserved[category] ?? 0;
                const eventBucket =
                  activePlan.planCategories[category] &&
                  activePlan.planCategories[category].length <= 1
                    ? null
                    : utils.getBucket({
                        events: reserved,
                        buckets: activePlan.planCategories[category],
                      });
                const price = eventBucket ? eventBucket.price : 0;
                const formattedPrice = utils.displayPrice({
                  cents: price,
                });
                const formattedReserved = formatReservedWithUnits(reserved, category);

                return (
                  <Flex key={category} justify="between" align="center">
                    <div>
                      {formattedReserved}{' '}
                      {reserved === 1 && category !== DataCategory.ATTACHMENTS
                        ? getSingularCategoryName({
                            plan: activePlan,
                            category,
                            capitalize: false,
                          })
                        : getPlanCategoryName({
                            plan: activePlan,
                            category,
                            capitalize: false,
                          })}
                    </div>
                    {price > 0 && (
                      <div>
                        {formattedPrice}/{shortInterval}
                      </div>
                    )}
                  </Flex>
                );
              })}
          </Flex>
        </ItemWithIcon>

        {/* TODO(checkout-v3): This will need to be updated for non-budget products */}
        {Object.values(activePlan.availableReservedBudgetTypes)
          .filter(
            budgetTypeInfo =>
              formData.selectedProducts?.[
                budgetTypeInfo.apiName as string as SelectableProduct
              ]?.enabled
          )
          .map(budgetTypeInfo => {
            const productIcon = getProductIcon(
              budgetTypeInfo.apiName as string as SelectableProduct
            );

            return (
              <ItemWithIcon
                key={budgetTypeInfo.apiName}
                data-test-id={`summary-item-product-${budgetTypeInfo.apiName}`}
              >
                <IconContainer>{productIcon}</IconContainer>
                <Flex direction="column" gap="xs">
                  <Flex justify="between" align="center">
                    <strong>
                      {toTitleCase(budgetTypeInfo.productCheckoutName, {
                        allowInnerUpperCase: true,
                      })}
                    </strong>
                    <div>
                      {utils.displayPrice({
                        cents: utils.getReservedPriceForReservedBudgetCategory({
                          plan: activePlan,
                          reservedBudgetCategory: budgetTypeInfo.apiName,
                        }),
                      })}
                      /{shortInterval}
                    </div>
                  </Flex>
                  {budgetTypeInfo.defaultBudget && (
                    <div>
                      {tct('Includes [includedBudget] monthly credits', {
                        includedBudget: utils.displayPrice({
                          cents: budgetTypeInfo.defaultBudget,
                        }),
                      })}
                    </div>
                  )}
                </Flex>
              </ItemWithIcon>
            );
          })}
      </SummarySection>
      <SummarySection>
        <Item>
          <Flex justify="between" align="center">
            <strong>{t('Total')}</strong>
            <strong>
              {formattedRecurringTotal}/{shortInterval}
            </strong>
          </Flex>
          <RenewalDate>
            {/* TODO(ISABELLA): If the customer is upgrading from free, their contract period will shift */}
            {tct('Renews [date]', {
              date: moment(subscription.contractPeriodEnd)
                .add(1, 'day')
                .format('MMM D, YYYY'),
            })}
          </RenewalDate>
        </Item>
        {!!formData.onDemandMaxSpend && (
          <Item>
            <Flex justify="between" align="center">
              <div>
                {tct('[budgetTerm] spend cap', {
                  budgetTerm: capitalize(activePlan.budgetTerm),
                })}
              </div>
              <div>
                $0-
                {utils.displayPrice({
                  cents: formData.onDemandMaxSpend ?? 0,
                })}
                /mo
              </div>
            </Flex>
          </Item>
        )}
        <Item>
          <Flex justify="between" align="center">
            <div>
              {tct('Max [interval] cost', {
                interval: activePlan.billingInterval,
              })}
            </div>
            <div>
              {formattedMaxCostPerInterval}/{shortInterval}
            </div>
          </Flex>
        </Item>
      </SummarySection>
      <SummarySection>
        <Item>
          <Flex justify="between" align="center">
            <DueToday>{t('Due today')}</DueToday>
            <DueTodayPrice>
              <DueTodayAmount>
                {/* TODO(ISABELLA): THis is not correct, we need to get the preview invoice total */}
                {utils.displayPrice({
                  cents: formData.onDemandMaxSpend ?? 0,
                })}
              </DueTodayAmount>
              <span> USD</span>
            </DueTodayPrice>
          </Flex>
        </Item>
      </SummarySection>
    </CartContainer>
  );
}

export default Cart;

const CartContainer = styled(Panel)`
  display: flex;
  flex-direction: column;
  padding: ${p => p.theme.space['2xl']} 0;
  gap: ${p => p.theme.space['2xl']};

  & > *:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const SummarySection = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 0 ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
`;

const Title = styled('h1')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0 0 ${p => p.theme.space.xl};
`;

const Item = styled('div')`
  line-height: normal;
  align-items: start;
  margin-bottom: ${p => p.theme.space.xl};
`;

const ItemWithIcon = styled(Item)`
  display: grid;
  grid-template-columns: min-content auto;
  gap: ${p => p.theme.space.xs};
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const RenewalDate = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const DueToday = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
`;

const DueTodayPrice = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
`;

const DueTodayAmount = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.xl};
`;
