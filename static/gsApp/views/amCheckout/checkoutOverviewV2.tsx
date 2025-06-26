import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Tag} from 'sentry/components/core/badge/tag';
import {Tooltip} from 'sentry/components/core/tooltip';
import Panel from 'sentry/components/panels/panel';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconLock, IconSentry} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import type {BillingConfig, Plan, Promotion, Subscription} from 'getsentry/types';
import {formatReservedWithUnits, isBizPlanFamily} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getSingularCategoryName,
  listDisplayNames,
} from 'getsentry/utils/dataCategory';
import type {CheckoutFormData, SelectableProduct} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

type Props = {
  activePlan: Plan;
  billingConfig: BillingConfig;
  formData: CheckoutFormData;
  onUpdate: (data: any) => void;
  organization: Organization;
  subscription: Subscription;
  discountInfo?: Promotion['discountInfo'];
};

function CheckoutOverviewV2({activePlan, formData, onUpdate: _onUpdate}: Props) {
  const shortInterval = useMemo(() => {
    return utils.getShortInterval(activePlan.billingInterval);
  }, [activePlan.billingInterval]);

  const isDefaultPaygAmount = useMemo(() => {
    const defaultAmount = isBizPlanFamily(activePlan)
      ? PAYG_BUSINESS_DEFAULT
      : PAYG_TEAM_DEFAULT;
    return formData.onDemandMaxSpend === defaultAmount;
  }, [activePlan, formData.onDemandMaxSpend]);

  const hasPaygProducts = useMemo(
    () => (formData.onDemandMaxSpend ?? 0) > 0,
    [formData.onDemandMaxSpend]
  );

  const renderPlanDetails = () => {
    return (
      <PanelChild>
        <SpaceBetweenRow>
          <div>
            <Title>{tct('Sentry [name] Plan', {name: activePlan.name})}</Title>
            <Description>
              {t(
                'This is your standard %s subscription charge.',
                activePlan.billingInterval === 'annual' ? 'yearly' : 'monthly'
              )}
            </Description>
          </div>
          <Title>
            {utils.displayPrice({cents: activePlan.totalPrice})}
            {`/${shortInterval}`}
          </Title>
        </SpaceBetweenRow>
      </PanelChild>
    );
  };

  const renderPayAsYouGoBudget = (paygBudgetTotal: number) => {
    return (
      <PanelChild>
        <Subtitle>{t('Additional Coverage')}</Subtitle>
        <SpaceBetweenRow style={{alignItems: 'start'}}>
          <Column>
            <Title>{t('Pay-as-you-go (PAYG) Budget')}</Title>
            <Description>
              {t('Charges are applied at the end of your monthly usage cycle.')}
            </Description>
          </Column>
          <Column minWidth="150px" alignItems="end">
            <Title>
              {paygBudgetTotal > 0 ? t('up to ') : null}
              {`${utils.displayPrice({cents: paygBudgetTotal})}/mo`}
            </Title>
            <AnimatePresence>
              {isDefaultPaygAmount && (
                <motion.div
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                  transition={{
                    type: 'spring',
                    duration: 0.4,
                    bounce: 0.1,
                  }}
                >
                  <DefaultAmountTag icon={<IconSentry />} type="info">
                    {t('Default Amount')}
                  </DefaultAmountTag>
                </motion.div>
              )}
            </AnimatePresence>
          </Column>
        </SpaceBetweenRow>
      </PanelChild>
    );
  };

  const renderProductBreakdown = () => {
    const hasAtLeastOneSelectedProduct = Object.values(
      activePlan.availableReservedBudgetTypes
    ).some(budgetTypeInfo => {
      return formData.selectedProducts?.[
        budgetTypeInfo.apiName as string as SelectableProduct
      ]?.enabled;
    });

    if (!hasAtLeastOneSelectedProduct) {
      return null;
    }

    return (
      <Fragment>
        <Separator />
        <Section>
          <ReservedVolumes>
            {Object.values(activePlan.availableReservedBudgetTypes).map(
              budgetTypeInfo => {
                const formDataForProduct =
                  formData.selectedProducts?.[
                    budgetTypeInfo.apiName as string as SelectableProduct
                  ];
                if (!formDataForProduct) {
                  return null;
                }

                if (formDataForProduct.enabled) {
                  return (
                    <SpaceBetweenRow
                      key={budgetTypeInfo.apiName}
                      data-test-id={`${budgetTypeInfo.apiName}-reserved`}
                    >
                      <ReservedItem isIndividualProduct>
                        {toTitleCase(budgetTypeInfo.productCheckoutName, {
                          allowInnerUpperCase: true,
                        })}
                        <QuestionTooltip
                          size="xs"
                          title={tct(
                            'Your [productName] subscription includes [budgetAmount] in monthly credits for [categories]; additional usage will draw from your PAYG budget.',
                            {
                              productName: toTitleCase(budgetTypeInfo.productName),
                              budgetAmount: utils.displayPrice({
                                cents: budgetTypeInfo.defaultBudget ?? 0,
                              }),
                              categories: listDisplayNames({
                                plan: activePlan,
                                categories: budgetTypeInfo.dataCategories,
                                shouldTitleCase: true,
                              }),
                            }
                          )}
                        />
                      </ReservedItem>
                      <Title>
                        {utils.displayPrice({
                          cents: utils.getReservedPriceForReservedBudgetCategory({
                            plan: activePlan,
                            reservedBudgetCategory: budgetTypeInfo.apiName,
                          }),
                        })}
                        /{shortInterval}
                      </Title>
                    </SpaceBetweenRow>
                  );
                }
                return null;
              }
            )}
          </ReservedVolumes>
        </Section>
      </Fragment>
    );
  };

  const renderObservabilityProductBreakdown = () => {
    const paygCategories = [
      DataCategory.MONITOR_SEATS,
      DataCategory.PROFILE_DURATION,
      DataCategory.PROFILE_DURATION_UI,
      DataCategory.UPTIME,
    ];

    const budgetCategories = Object.values(
      activePlan.availableReservedBudgetTypes
    ).reduce((acc, type) => {
      acc.push(...type.dataCategories);
      return acc;
    }, [] as DataCategory[]);

    return (
      <Section>
        <ReservedVolumes>
          {activePlan.categories
            .filter(category => !budgetCategories.includes(category))
            .map(category => {
              const eventBucket =
                activePlan.planCategories[category] &&
                activePlan.planCategories[category].length <= 1
                  ? null
                  : utils.getBucket({
                      events: formData.reserved[category],
                      buckets: activePlan.planCategories[category],
                    });
              const price = utils.displayPrice({
                cents: eventBucket ? eventBucket.price : 0,
              });
              const isMoreThanIncluded =
                (formData.reserved[category] ?? 0) >
                (activePlan.planCategories[category]?.[0]?.events ?? 0);
              return (
                <SpaceBetweenRow
                  key={category}
                  data-test-id={`${category}-reserved`}
                  style={{alignItems: 'center'}}
                >
                  <ReservedItem>
                    {(formData.reserved[category] ?? 0) > 0 && (
                      <Fragment>
                        <ReservedNumberEmphasisText>
                          {formatReservedWithUnits(
                            formData.reserved[category] ?? 0,
                            category
                          )}
                        </ReservedNumberEmphasisText>{' '}
                      </Fragment>
                    )}
                    {formData.reserved[category] === 1 &&
                    category !== DataCategory.ATTACHMENTS
                      ? getSingularCategoryName({
                          plan: activePlan,
                          category,
                          title: true,
                        })
                      : getPlanCategoryName({
                          plan: activePlan,
                          category,
                          title: true,
                        })}
                    {paygCategories.includes(category) ? (
                      <QuestionTooltip
                        size="xs"
                        title={t(
                          "%s use your pay-as-you-go budget. You'll only be charged for actual usage.",
                          getPlanCategoryName({
                            plan: activePlan,
                            category,
                          })
                        )}
                      />
                    ) : null}
                  </ReservedItem>
                  <Price>
                    {isMoreThanIncluded ? (
                      `+ ${price}/${shortInterval}`
                    ) : activePlan.checkoutCategories.includes(category) ? (
                      <Tag>{t('Included')}</Tag>
                    ) : hasPaygProducts ? (
                      <Tag>{t('Available')}</Tag>
                    ) : (
                      <Tooltip
                        title={t('This product is only available with a PAYG budget.')}
                      >
                        <Tag icon={<IconLock locked size="xs" />}>
                          {t('Product not available')}
                        </Tag>
                      </Tooltip>
                    )}
                  </Price>
                </SpaceBetweenRow>
              );
            })}
        </ReservedVolumes>
      </Section>
    );
  };

  const renderTotals = (committedTotal: number, paygMonthlyBudget: number) => {
    return (
      <SubscriptionTotal>
        <SpaceBetweenRow>
          <Column>
            <Subtitle>{t('Subscription Total')}</Subtitle>
            <Title>
              {tct('Total [interval] Charges', {
                interval: activePlan.billingInterval === 'annual' ? 'Annual' : 'Monthly',
              })}
            </Title>
          </Column>
          <Column>
            <TotalPrice>{`${utils.displayPrice({cents: committedTotal})}/${shortInterval}`}</TotalPrice>
            <AnimatePresence>
              {paygMonthlyBudget > 0 ? (
                <motion.div
                  initial={{height: 0, opacity: 0}}
                  animate={{height: 'auto', opacity: 1}}
                  exit={{height: 0, opacity: 0}}
                  transition={{
                    type: 'spring',
                    duration: 0.4,
                    bounce: 0.1,
                  }}
                >
                  <AdditionalMonthlyCharge data-test-id="additional-monthly-charge">
                    <span>
                      {tct('+ up to [monthlyMax] based on PAYG usage', {
                        monthlyMax: (
                          <EmphasisText>{`${utils.displayPrice({cents: paygMonthlyBudget})}/mo`}</EmphasisText>
                        ),
                      })}{' '}
                    </span>
                    <QuestionTooltip
                      size="xs"
                      title={t(
                        "This is your pay-as-you-go budget, which ensures continued monitoring after you've used up your reserved event volume. We'll only charge you for actual usage, so this is your maximum charge for overage."
                      )}
                    />
                  </AdditionalMonthlyCharge>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Column>
        </SpaceBetweenRow>
      </SubscriptionTotal>
    );
  };

  const committedTotal = utils.getReservedPriceCents({...formData, plan: activePlan});
  const paygMonthlyBudget = formData.onDemandMaxSpend || 0;

  return (
    <StyledPanel data-test-id="checkout-overview-v2">
      {renderPlanDetails()}
      <Separator />
      {renderObservabilityProductBreakdown()}
      {renderProductBreakdown()}
      <Separator />
      {renderPayAsYouGoBudget(paygMonthlyBudget)}
      <TotalSeparator />
      {renderTotals(committedTotal, paygMonthlyBudget)}
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
`;

const PanelChild = styled('div')`
  margin: ${space(2)};
`;

const Column = styled('div')<{alignItems?: string; minWidth?: string}>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: ${p => p.alignItems || 'normal'};
  min-width: ${p => p.minWidth || 'auto'};
`;

const Description = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const SpaceBetweenRow = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  gap: ${space(4)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  line-height: initial;
`;

const Subtitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
`;

const ReservedVolumes = styled('div')`
  display: grid;
  gap: ${space(1.5)};
`;

const ReservedItem = styled(Title)<{isIndividualProduct?: boolean}>`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  color: ${p => (p.isIndividualProduct ? p.theme.textColor : p.theme.subText)};
  font-weight: ${p => (p.isIndividualProduct ? 600 : 'normal')};
`;

const Section = styled(PanelChild)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.lg};
`;

const Separator = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0 ${space(2)};
`;

const TotalSeparator = styled(Separator)`
  margin: 0;
  border-color: ${p => p.theme.border};
`;

const Price = styled('div')`
  justify-self: end;
  color: ${p => p.theme.textColor};
  display: flex;
  justify-content: end;
`;

const TotalPrice = styled(Price)`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: 600;
`;

const AdditionalMonthlyCharge = styled('div')`
  text-align: right;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  text-wrap: pretty;
`;

const EmphasisText = styled('span')`
  color: ${p => p.theme.textColor};
  font-weight: 600;
`;

const ReservedNumberEmphasisText = styled(EmphasisText)`
  color: ${p => p.theme.purple300};
`;

const DefaultAmountTag = styled(Tag)`
  max-width: fit-content;
  display: flex;
  align-items: center;
  line-height: normal;
`;

const SubscriptionTotal = styled(PanelChild)`
  background-color: ${p => p.theme.backgroundSecondary};
  margin: 0;
  padding: ${space(1.5)} ${space(2)} ${space(2)};
`;

export default CheckoutOverviewV2;
